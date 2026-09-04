-- Ajustes finales del asistente para pagos sobre reservas existentes.
-- 1) Mejor coincidencia por tokens del nombre (ej. "Alejandro Ramos" -> "Alejandro Ramos Donaire").
-- 2) Detección de transferencia duplicada por reserva + glosa + monto + fecha Chile.

create or replace function public.haiku_buscar_reservas_pago_asistente(
  p_cabana_numero smallint,
  p_titular text default null,
  p_cloudbeds_id text default null
)
returns table(
  reserva_id uuid,
  titular_nombre text,
  cloudbeds_id text,
  codigo_haiku text,
  estado_reserva text,
  cabana_numero smallint,
  fecha_ingreso date,
  fecha_salida date,
  total_alojamiento bigint,
  pagado_alojamiento bigint,
  saldo_alojamiento bigint,
  saldo_a_favor bigint,
  coincidencia integer,
  pagos_recientes jsonb
)
language plpgsql
security definer
set search_path to pg_catalog, public, private, pg_temp
as $function$
declare
  v_nombre text := regexp_replace(
    translate(lower(btrim(coalesce(p_titular, ''))), 'áéíóúüñ', 'aeiouun'),
    '[^a-z0-9]+', ' ', 'g'
  );
  v_cloudbeds text := nullif(btrim(coalesce(p_cloudbeds_id, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Debe iniciar sesión para buscar reservas';
  end if;
  if not private.haiku_tiene_permiso('pagos.ver') then
    raise exception 'Tu usuario no tiene permiso para consultar pagos' using errcode = '42501';
  end if;
  if p_cabana_numero is null and v_cloudbeds is null then
    raise exception 'Debes indicar una cabaña o ID Cloudbeds para buscar la reserva';
  end if;

  return query
  with candidatos as (
    select r.id reserva_id, r.titular_nombre, r.cloudbeds_id, r.codigo_haiku, r.estado_reserva,
           c.numero cabana_numero, re.fecha_ingreso, re.fecha_salida,
           coalesce(s.total_alojamiento,0)::bigint total_alojamiento,
           coalesce(s.pagado_alojamiento,0)::bigint pagado_alojamiento,
           coalesce(s.saldo_alojamiento,0)::bigint saldo_alojamiento,
           regexp_replace(translate(lower(coalesce(r.titular_nombre,'')),'áéíóúüñ','aeiouun'),'[^a-z0-9]+',' ','g') nombre_normalizado
    from public.reservas r
    join public.reserva_estadias re on re.reserva_id=r.id
    join public.cabanas c on c.id=re.cabana_id
    left join public.vista_saldos_alojamiento_reserva s on s.reserva_id=r.id
    where r.estado_reserva <> 'cancelada'
      and (p_cabana_numero is null or c.numero=p_cabana_numero)
      and (v_cloudbeds is null or r.cloudbeds_id=v_cloudbeds)
  ), puntuados as (
    select c.*,
      case
        when v_cloudbeds is not null and c.cloudbeds_id=v_cloudbeds then 200
        when btrim(v_nombre)='' then 50
        when btrim(c.nombre_normalizado)=btrim(v_nombre) then 100
        when c.nombre_normalizado like btrim(v_nombre)||'%' or btrim(v_nombre) like btrim(c.nombre_normalizado)||'%' then 90
        when not exists (
          select 1 from regexp_split_to_table(btrim(v_nombre),'\s+') token
          where length(token)>=2 and c.nombre_normalizado not like '%'||token||'%'
        ) then 85
        when c.nombre_normalizado like '%'||btrim(v_nombre)||'%' or btrim(v_nombre) like '%'||btrim(c.nombre_normalizado)||'%' then 80
        else 0
      end score
    from candidatos c
  )
  select p.reserva_id,p.titular_nombre,p.cloudbeds_id,p.codigo_haiku,p.estado_reserva,p.cabana_numero,
         p.fecha_ingreso,p.fecha_salida,p.total_alojamiento,p.pagado_alojamiento,p.saldo_alojamiento,
         coalesce((public.haiku_saldo_favor_unidad(p.reserva_id)->>'saldo_a_favor')::bigint,0),
         p.score,
         coalesce((select jsonb_agg(jsonb_build_object(
           'pago_id',x.id,'monto',x.monto,'medio',x.medio_pago,'estado',x.estado,'fecha_pago',x.fecha_pago,
           'fecha_pago_chile',timezone('America/Santiago',x.fecha_pago)::date,'codaut',x.codigo_autorizacion,
           'folio',x.folio,'bovtar',x.bove,'glosa',x.referencia_externa
         ) order by x.fecha_pago desc,x.id desc)
         from (select pg.* from public.pagos pg where pg.reserva_id=p.reserva_id and pg.tipo_movimiento='pago' and pg.estado<>'anulado' order by pg.fecha_pago desc,pg.id desc limit 10) x),'[]'::jsonb)
  from puntuados p
  where p.score>0
  order by p.score desc, abs(p.fecha_ingreso-current_date), p.fecha_ingreso desc, p.reserva_id
  limit 5;
end;
$function$;

revoke all on function public.haiku_buscar_reservas_pago_asistente(smallint,text,text) from public;
grant execute on function public.haiku_buscar_reservas_pago_asistente(smallint,text,text) to authenticated;

create or replace function public.haiku_registrar_abonos_reserva_existente_asistente(
  p_reserva_id uuid,
  p_pagos jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path to public, private, pg_temp
as $function$
declare
  v_item jsonb;
  v_medio text;
  v_monto bigint;
  v_fecha timestamptz;
  v_glosa text;
  v_codaut text;
  v_folio text;
  v_bovtar text;
  v_pago jsonb;
  v_pago_id uuid;
  v_resultados jsonb := '[]'::jsonb;
  v_indice integer := 0;
  v_estado text;
  v_titular text;
  v_saldo_anterior bigint := 0;
  v_saldo_final bigint := 0;
  v_credito jsonb;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión para registrar pagos'; end if;
  if not private.haiku_tiene_permiso('pagos.registrar') then raise exception 'Tu usuario no tiene permiso para registrar pagos' using errcode = '42501'; end if;
  if not private.haiku_tiene_permiso('pagos.verificar') then raise exception 'Tu usuario no tiene permiso para verificar pagos' using errcode = '42501'; end if;

  select estado_reserva, titular_nombre into v_estado, v_titular
  from public.reservas where id=p_reserva_id for update;
  if not found then raise exception 'La reserva seleccionada no existe'; end if;
  if v_estado='cancelada' then raise exception 'No se pueden registrar abonos en una reserva cancelada'; end if;

  if jsonb_typeof(coalesce(p_pagos,'[]'::jsonb)) <> 'array' then raise exception 'Los abonos deben enviarse como arreglo'; end if;
  if jsonb_array_length(coalesce(p_pagos,'[]'::jsonb)) < 1 then raise exception 'Debe existir al menos un abono'; end if;
  if jsonb_array_length(p_pagos) > 10 then raise exception 'Se admiten como máximo 10 abonos'; end if;

  select coalesce(saldo_alojamiento,0)::bigint into v_saldo_anterior
  from public.vista_saldos_alojamiento_reserva where reserva_id=p_reserva_id;
  v_saldo_anterior := coalesce(v_saldo_anterior,0);

  for v_item in select value from jsonb_array_elements(p_pagos)
  loop
    v_indice := v_indice+1;
    if jsonb_typeof(v_item)<>'object' then raise exception 'Cada abono debe ser un objeto'; end if;

    v_medio := lower(btrim(coalesce(v_item->>'medio','')));
    if v_medio not in ('transferencia','webpay_credito','webpay_debito','tarjeta_credito','tarjeta_debito','efectivo') then
      raise exception 'Medio de abono no admitido: %',coalesce(v_medio,'');
    end if;
    if coalesce(v_item->>'monto','') !~ '^[0-9]+$' then raise exception 'Cada abono requiere un monto entero válido'; end if;
    v_monto := (v_item->>'monto')::bigint;
    if v_monto<=0 then raise exception 'Cada abono debe ser mayor que cero'; end if;
    begin v_fecha := nullif(v_item->>'fecha_pago','')::timestamptz;
    exception when others then raise exception 'Cada abono requiere una fecha válida'; end;
    if v_fecha is null then raise exception 'Cada abono requiere una fecha válida'; end if;

    v_glosa := nullif(btrim(coalesce(v_item->>'glosa','')),'');
    v_codaut := nullif(btrim(coalesce(v_item->>'codaut','')),'');
    v_folio := nullif(btrim(coalesce(v_item->>'folio','')),'');
    v_bovtar := nullif(btrim(coalesce(v_item->>'bovtar','')),'');

    if v_medio='transferencia' then
      if v_glosa is null then raise exception 'Cada transferencia requiere Glosa'; end if;
      if exists (
        select 1 from public.pagos p
        where p.tipo_movimiento='pago' and p.estado<>'anulado' and p.reserva_id=p_reserva_id
          and p.medio_pago='transferencia' and p.monto=v_monto and p.referencia_externa=v_glosa
          and timezone('America/Santiago',p.fecha_pago)::date=timezone('America/Santiago',v_fecha)::date
      ) then raise exception 'Ya existe una transferencia no anulada con la misma Glosa, monto y fecha en esta reserva'; end if;
    end if;

    if v_medio in ('webpay_credito','webpay_debito') then
      if v_codaut is null then raise exception 'Cada WebPay requiere CodAut'; end if;
      if exists (select 1 from public.pagos p where p.tipo_movimiento='pago' and p.estado<>'anulado' and p.medio_pago=v_medio and p.codigo_autorizacion=v_codaut)
      then raise exception 'Ya existe un WebPay no anulado con el mismo CodAut y medio'; end if;
    end if;

    if v_medio in ('tarjeta_credito','tarjeta_debito') then
      if v_folio is null then raise exception 'Cada pago con tarjeta requiere Folio'; end if;
      if v_bovtar is null then raise exception 'Cada pago con tarjeta requiere BOVTAR'; end if;
      if exists (select 1 from public.pagos p where p.tipo_movimiento='pago' and p.estado<>'anulado' and p.medio_pago=v_medio and p.folio=v_folio and p.bove=v_bovtar)
      then raise exception 'Ya existe un pago con tarjeta no anulado con el mismo Folio, BOVTAR y medio'; end if;
    end if;

    v_pago := public.haiku_registrar_pago(
      p_reserva_id=>p_reserva_id,p_monto=>v_monto,p_medio_pago=>v_medio,p_etapa_operativa=>'abono',p_fecha_pago=>v_fecha,
      p_folio=>case when v_medio in ('tarjeta_credito','tarjeta_debito') then v_folio else null end,
      p_codigo_autorizacion=>case when v_medio in ('webpay_credito','webpay_debito') then v_codaut else null end,
      p_bove=>case when v_medio in ('tarjeta_credito','tarjeta_debito') then v_bovtar else null end,
      p_referencia_externa=>case when v_medio='transferencia' then v_glosa else null end,
      p_observaciones=>'Abono confirmado desde asistente HAIKU sobre reserva existente',p_aplicaciones=>'[]'::jsonb,p_modo_aplicacion=>'alojamiento'
    );
    v_pago_id := (v_pago->>'pago_id')::uuid;

    update public.pagos set verificado_por=auth.uid(),verificado_en=now(),pagador_nombre=coalesce(v_titular,pagador_nombre),
      datos_origen=coalesce(datos_origen,'{}'::jsonb)||jsonb_build_object('contexto','asistente_pago_reserva_existente','manager_revisado',true,'indice_abono',v_indice,'saldo_a_favor_generado',coalesce((v_pago->>'sin_aplicar')::bigint,0))
    where id=v_pago_id;

    v_resultados := v_resultados || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'indice',v_indice,'pago_id',v_pago_id,'medio',v_medio,'monto',v_monto,'aplicado',coalesce((v_pago->>'aplicado')::bigint,0),'sin_aplicar',coalesce((v_pago->>'sin_aplicar')::bigint,0),
      'codaut',case when v_medio in ('webpay_credito','webpay_debito') then v_codaut else null end,'glosa',case when v_medio='transferencia' then v_glosa else null end,
      'folio',case when v_medio in ('tarjeta_credito','tarjeta_debito') then v_folio else null end,'bovtar',case when v_medio in ('tarjeta_credito','tarjeta_debito') then v_bovtar else null end
    )));
  end loop;

  select coalesce(saldo_alojamiento,0)::bigint into v_saldo_final from public.vista_saldos_alojamiento_reserva where reserva_id=p_reserva_id;
  v_saldo_final := coalesce(v_saldo_final,0);
  v_credito := public.haiku_saldo_favor_unidad(p_reserva_id);

  return jsonb_build_object('reserva_id',p_reserva_id,'titular',v_titular,'saldo_anterior',v_saldo_anterior,'saldo_restante',v_saldo_final,
    'saldo_a_favor',coalesce((v_credito->>'saldo_a_favor')::bigint,0),'cantidad_pagos',jsonb_array_length(v_resultados),'pagos',v_resultados);
end;
$function$;

revoke all on function public.haiku_registrar_abonos_reserva_existente_asistente(uuid,jsonb) from public;
grant execute on function public.haiku_registrar_abonos_reserva_existente_asistente(uuid,jsonb) to authenticated;
