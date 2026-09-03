-- HAIKU · Saldo a favor reutilizable
-- El excedente de un pago de alojamiento queda sin aplicar y puede cubrir cargos de servicios.

create or replace function public.haiku_validar_pago_aplicacion()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
declare
  v_tipo_pago text;
  v_estado_pago text;
  v_reserva_pago uuid;
  v_pago_origen uuid;
  v_monto_pago bigint;
  v_reserva_cargo uuid;
  v_estado_cargo text;
  v_monto_cargo bigint;
  v_grupo_pago uuid;
  v_grupo_cargo uuid;
  v_suma_pago bigint;
  v_neto_cargo bigint;
  v_aplicado_original bigint;
  v_devuelto_mismo_origen bigint;
begin
  select tipo_movimiento, estado, reserva_id, pago_origen_id, monto
    into v_tipo_pago, v_estado_pago, v_reserva_pago, v_pago_origen, v_monto_pago
  from public.pagos where id = new.pago_id;
  if not found then raise exception 'El pago de la aplicación no existe'; end if;
  if v_estado_pago <> 'confirmado' then raise exception 'Sólo los pagos o devoluciones confirmados pueden aplicarse a cargos'; end if;

  select reserva_id, estado, monto
    into v_reserva_cargo, v_estado_cargo, v_monto_cargo
  from public.cargos where id = new.cargo_id;
  if not found then raise exception 'El cargo de la aplicación no existe'; end if;

  if v_reserva_pago is distinct from v_reserva_cargo then
    select grupo_reserva_id into v_grupo_pago from public.reservas where id = v_reserva_pago;
    select grupo_reserva_id into v_grupo_cargo from public.reservas where id = v_reserva_cargo;
    if v_grupo_pago is null or v_grupo_cargo is null or v_grupo_pago is distinct from v_grupo_cargo then
      raise exception 'El pago y el cargo deben pertenecer a la misma reserva o reserva conjunta';
    end if;
  end if;

  if v_estado_cargo <> 'activo' then raise exception 'No se puede aplicar dinero a un cargo anulado'; end if;

  select coalesce(sum(pa.monto_aplicado),0) into v_suma_pago
  from public.pago_aplicaciones pa
  where pa.pago_id = new.pago_id and pa.id <> new.id;
  if v_suma_pago + new.monto_aplicado > v_monto_pago then
    raise exception 'Las aplicaciones superan el monto disponible del pago/devolución';
  end if;

  if v_tipo_pago = 'pago' then
    select coalesce(sum(case when p.tipo_movimiento='pago' then pa.monto_aplicado when p.tipo_movimiento='devolucion' then -pa.monto_aplicado else 0 end),0)
      into v_neto_cargo
    from public.pago_aplicaciones pa join public.pagos p on p.id=pa.pago_id
    where pa.cargo_id=new.cargo_id and p.estado='confirmado' and pa.id<>new.id;
    if v_neto_cargo + new.monto_aplicado > v_monto_cargo then raise exception 'La aplicación supera el saldo disponible del cargo'; end if;
  elsif v_tipo_pago = 'devolucion' then
    if v_pago_origen is null then raise exception 'La devolución no tiene pago original'; end if;
    select coalesce(max(pa.monto_aplicado),0) into v_aplicado_original
    from public.pago_aplicaciones pa where pa.pago_id=v_pago_origen and pa.cargo_id=new.cargo_id;
    if v_aplicado_original=0 then raise exception 'El pago original no fue aplicado a este cargo'; end if;
    select coalesce(sum(pa.monto_aplicado),0) into v_devuelto_mismo_origen
    from public.pago_aplicaciones pa join public.pagos p on p.id=pa.pago_id
    where p.pago_origen_id=v_pago_origen and p.tipo_movimiento='devolucion' and p.estado='confirmado' and pa.cargo_id=new.cargo_id and pa.id<>new.id;
    if v_devuelto_mismo_origen + new.monto_aplicado > v_aplicado_original then raise exception 'La devolución aplicada al cargo supera lo cubierto por el pago original'; end if;
  end if;
  return new;
end;
$function$;

create or replace function public.haiku_registrar_pago_grupo(
    p_reserva_id uuid,
    p_monto bigint,
    p_medio_pago text,
    p_etapa_operativa text default 'abono',
    p_fecha_pago timestamptz default now(),
    p_folio text default null,
    p_codigo_autorizacion text default null,
    p_bove text default null,
    p_referencia_externa text default null,
    p_observaciones text default null
)
returns jsonb
language plpgsql
set search_path to 'public','private','pg_temp'
as $function$
declare
    v_grupo_id uuid; v_titular text; v_documento text;
    v_total_saldo bigint:=0; v_aplicar_total bigint:=0; v_credito bigint:=0; v_restante bigint:=0; v_asignado bigint:=0;
    v_pago_grupo_id uuid:=gen_random_uuid(); v_item record; v_parte bigint; v_resultado jsonb; v_pago_id uuid; v_pago_credito_id uuid;
    v_distribucion jsonb:='[]'::jsonb; v_indice integer:=0; v_cantidad integer:=0;
begin
    if auth.uid() is null then raise exception 'Debe iniciar sesión para registrar pagos'; end if;
    if not private.haiku_tiene_permiso('pagos.registrar') then raise exception 'Tu usuario no tiene permiso para registrar pagos'; end if;
    if p_monto is null or p_monto<=0 then raise exception 'El monto debe ser mayor que cero'; end if;
    select r.grupo_reserva_id,r.titular_nombre,r.titular_numero_documento into v_grupo_id,v_titular,v_documento from public.reservas r where r.id=p_reserva_id;
    if not found then raise exception 'Reserva no encontrada'; end if;

    if v_grupo_id is null then
      v_resultado:=public.haiku_registrar_pago(p_reserva_id=>p_reserva_id,p_monto=>p_monto,p_medio_pago=>p_medio_pago,p_etapa_operativa=>p_etapa_operativa,p_fecha_pago=>p_fecha_pago,p_folio=>p_folio,p_codigo_autorizacion=>p_codigo_autorizacion,p_bove=>p_bove,p_referencia_externa=>p_referencia_externa,p_observaciones=>p_observaciones,p_aplicaciones=>'[]'::jsonb,p_modo_aplicacion=>'alojamiento');
      return jsonb_build_object('es_grupo',false,'monto',p_monto,'pago_id',v_resultado->>'pago_id','aplicado_alojamiento',coalesce((v_resultado->>'aplicado')::bigint,0),'saldo_a_favor_generado',coalesce((v_resultado->>'sin_aplicar')::bigint,0));
    end if;

    with saldos as (
      select r.id reserva_id,min(c.numero) numero,coalesce(sum(case when ec.tipo_cargo='alojamiento' and ec.estado='activo' then ec.saldo_cargo else 0 end),0)::bigint saldo
      from public.reservas r left join public.reserva_estadias re on re.reserva_id=r.id left join public.cabanas c on c.id=re.cabana_id left join public.vista_estado_cargos ec on ec.reserva_id=r.id
      where r.grupo_reserva_id=v_grupo_id group by r.id
    ) select coalesce(sum(saldo),0)::bigint,count(*) filter(where saldo>0)::integer into v_total_saldo,v_cantidad from saldos;

    v_aplicar_total:=least(p_monto,greatest(v_total_saldo,0)); v_credito:=p_monto-v_aplicar_total; v_restante:=v_aplicar_total;
    if v_aplicar_total>0 then
      for v_item in
        with saldos as (
          select r.id reserva_id,min(c.numero) numero,coalesce(sum(case when ec.tipo_cargo='alojamiento' and ec.estado='activo' then ec.saldo_cargo else 0 end),0)::bigint saldo
          from public.reservas r left join public.reserva_estadias re on re.reserva_id=r.id left join public.cabanas c on c.id=re.cabana_id left join public.vista_estado_cargos ec on ec.reserva_id=r.id
          where r.grupo_reserva_id=v_grupo_id group by r.id
        ) select * from saldos where saldo>0 order by numero nulls last,reserva_id
      loop
        v_indice:=v_indice+1;
        if v_indice=v_cantidad then v_parte:=v_restante; else v_parte:=floor((v_aplicar_total::numeric*v_item.saldo::numeric)/greatest(v_total_saldo,1)::numeric)::bigint; v_parte:=least(v_parte,v_item.saldo,v_restante); end if;
        if v_parte<=0 then continue; end if;
        v_resultado:=public.haiku_registrar_pago(p_reserva_id=>v_item.reserva_id,p_monto=>v_parte,p_medio_pago=>p_medio_pago,p_etapa_operativa=>p_etapa_operativa,p_fecha_pago=>p_fecha_pago,p_folio=>p_folio,p_codigo_autorizacion=>p_codigo_autorizacion,p_bove=>p_bove,p_referencia_externa=>p_referencia_externa,p_observaciones=>concat_ws(' · ',nullif(btrim(coalesce(p_observaciones,'')),''),'Pago conjunto'),p_aplicaciones=>'[]'::jsonb,p_modo_aplicacion=>'alojamiento');
        v_pago_id:=(v_resultado->>'pago_id')::uuid;
        update public.pagos set pago_grupo_id=v_pago_grupo_id,pagador_nombre=coalesce(v_titular,pagador_nombre),pagador_documento=coalesce(v_documento,pagador_documento) where id=v_pago_id;
        v_distribucion:=v_distribucion||jsonb_build_array(jsonb_build_object('reserva_id',v_item.reserva_id,'cabana',v_item.numero,'monto',v_parte,'pago_id',v_pago_id,'tipo','alojamiento'));
        v_asignado:=v_asignado+v_parte;v_restante:=v_restante-v_parte;
      end loop;
    end if;
    if v_restante<>0 or v_asignado<>v_aplicar_total then raise exception 'No fue posible distribuir completamente la parte destinada al alojamiento'; end if;

    if v_credito>0 then
      v_resultado:=public.haiku_registrar_pago(p_reserva_id=>p_reserva_id,p_monto=>v_credito,p_medio_pago=>p_medio_pago,p_etapa_operativa=>p_etapa_operativa,p_fecha_pago=>p_fecha_pago,p_folio=>p_folio,p_codigo_autorizacion=>p_codigo_autorizacion,p_bove=>p_bove,p_referencia_externa=>p_referencia_externa,p_observaciones=>concat_ws(' · ',nullif(btrim(coalesce(p_observaciones,'')),''),'Saldo a favor de pago conjunto'),p_aplicaciones=>'[]'::jsonb,p_modo_aplicacion=>'ninguno');
      v_pago_credito_id:=(v_resultado->>'pago_id')::uuid;
      update public.pagos set pago_grupo_id=v_pago_grupo_id,pagador_nombre=coalesce(v_titular,pagador_nombre),pagador_documento=coalesce(v_documento,pagador_documento),datos_origen=coalesce(datos_origen,'{}'::jsonb)||jsonb_build_object('saldo_a_favor_origen',true) where id=v_pago_credito_id;
      v_distribucion:=v_distribucion||jsonb_build_array(jsonb_build_object('reserva_id',p_reserva_id,'monto',v_credito,'pago_id',v_pago_credito_id,'tipo','saldo_a_favor'));
    end if;

    if p_etapa_operativa='abono' then
      update public.reservas set estado_reserva='confirmada' where grupo_reserva_id=v_grupo_id and estado_reserva='pendiente';
      update public.reserva_estadias re set estado_estadia='confirmada' where re.reserva_id in(select id from public.reservas where grupo_reserva_id=v_grupo_id) and re.estado_estadia='pendiente';
    end if;
    return jsonb_build_object('es_grupo',true,'grupo_reserva_id',v_grupo_id,'pago_grupo_id',v_pago_grupo_id,'monto',p_monto,'aplicado_alojamiento',v_aplicar_total,'saldo_a_favor_generado',v_credito,'distribucion',v_distribucion);
end;
$function$;

create or replace function public.haiku_saldo_favor_unidad(p_reserva_id uuid)
returns jsonb language plpgsql security definer set search_path to 'public','private','pg_temp'
as $function$
declare v_grupo_id uuid;v_titular text;v_fuentes jsonb:='[]'::jsonb;v_cargos jsonb:='[]'::jsonb;v_total bigint:=0;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión para consultar saldo a favor'; end if;
  if not private.haiku_tiene_permiso('pagos.ver') then raise exception 'Tu usuario no tiene permiso para consultar pagos'; end if;
  select grupo_reserva_id,titular_nombre into v_grupo_id,v_titular from public.reservas where id=p_reserva_id;if not found then raise exception 'Reserva no encontrada';end if;
  with unidad as(select r.id from public.reservas r where(v_grupo_id is null and r.id=p_reserva_id)or(v_grupo_id is not null and r.grupo_reserva_id=v_grupo_id)),
  fuentes as(select p.id pago_id,p.reserva_id,p.pago_grupo_id,p.monto monto_original,p.medio_pago,p.fecha_pago,p.referencia_externa glosa,p.folio,p.codigo_autorizacion,p.bove bovtar,
    greatest(p.monto-coalesce((select sum(d.monto)from public.pagos d where d.pago_origen_id=p.id and d.tipo_movimiento='devolucion' and d.estado='confirmado'),0)-coalesce((select sum(pa.monto_aplicado)from public.pago_aplicaciones pa where pa.pago_id=p.id),0)+coalesce((select sum(pa2.monto_aplicado)from public.pago_aplicaciones pa2 join public.pagos d2 on d2.id=pa2.pago_id where d2.pago_origen_id=p.id and d2.tipo_movimiento='devolucion' and d2.estado='confirmado'),0),0)::bigint disponible
    from public.pagos p where p.reserva_id in(select id from unidad)and p.tipo_movimiento='pago'and p.estado='confirmado'and p.etapa_operativa in('abono','saldo')),
  disponibles as(select * from fuentes where disponible>0)
  select coalesce(sum(disponible),0)::bigint,coalesce(jsonb_agg(jsonb_build_object('pago_id',pago_id,'reserva_id',reserva_id,'pago_grupo_id',pago_grupo_id,'monto_original',monto_original,'disponible',disponible,'medio_pago',medio_pago,'fecha_pago',fecha_pago,'glosa',glosa,'folio',folio,'codigo_autorizacion',codigo_autorizacion,'bovtar',bovtar)order by fecha_pago,pago_id),'[]'::jsonb) into v_total,v_fuentes from disponibles;
  with unidad as(select r.id from public.reservas r where(v_grupo_id is null and r.id=p_reserva_id)or(v_grupo_id is not null and r.grupo_reserva_id=v_grupo_id))
  select coalesce(jsonb_agg(jsonb_build_object('cargo_id',ec.cargo_id,'reserva_id',ec.reserva_id,'servicio_id',ec.servicio_id,'concepto',coalesce(cs.nombre,ec.concepto,'Servicio'),'monto',ec.monto_ajustado,'saldo',ec.saldo_cargo,'fecha_servicio',s.fecha_servicio,'hora',s.hora_inicio,'cabana',cab.numero)order by s.fecha_servicio nulls last,s.hora_inicio nulls last,ec.cargo_id),'[]'::jsonb) into v_cargos
  from public.vista_estado_cargos ec left join public.servicios s on s.id=ec.servicio_id left join public.catalogo_servicios cs on cs.id=s.catalogo_servicio_id left join public.reserva_estadias re on re.id=ec.estadia_id left join public.cabanas cab on cab.id=re.cabana_id where ec.reserva_id in(select id from unidad)and ec.tipo_cargo='servicio'and ec.estado='activo'and ec.saldo_cargo>0;
  return jsonb_build_object('es_grupo',v_grupo_id is not null,'grupo_reserva_id',v_grupo_id,'reserva_id',p_reserva_id,'titular',v_titular,'saldo_a_favor',v_total,'fuentes',v_fuentes,'cargos_servicio',v_cargos);
end;$function$;

create or replace function public.haiku_usar_saldo_favor(p_reserva_id uuid,p_cargo_id uuid,p_monto bigint default null)
returns jsonb language plpgsql security definer set search_path to 'public','private','pg_temp'
as $function$
declare v_grupo_id uuid;v_reserva_cargo uuid;v_grupo_cargo uuid;v_tipo_cargo text;v_estado_cargo text;v_saldo_cargo bigint:=0;v_saldo_favor bigint:=0;v_objetivo bigint:=0;v_restante bigint:=0;v_aplicar bigint:=0;v_fuente record;v_usadas jsonb:='[]'::jsonb;v_resumen jsonb;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión para usar saldo a favor';end if;
  if not private.haiku_tiene_permiso('pagos.registrar') then raise exception 'Tu usuario no tiene permiso para aplicar pagos';end if;
  select grupo_reserva_id into v_grupo_id from public.reservas where id=p_reserva_id;if not found then raise exception 'Reserva no encontrada';end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(v_grupo_id::text,p_reserva_id::text),0));
  select c.reserva_id,c.tipo_cargo,c.estado,coalesce(ec.saldo_cargo,0)::bigint into v_reserva_cargo,v_tipo_cargo,v_estado_cargo,v_saldo_cargo from public.cargos c left join public.vista_estado_cargos ec on ec.cargo_id=c.id where c.id=p_cargo_id for update of c;
  if not found then raise exception 'Cargo de servicio no encontrado';end if;if v_tipo_cargo<>'servicio'or v_estado_cargo<>'activo'then raise exception 'El saldo a favor sólo puede aplicarse a un servicio activo';end if;
  if v_reserva_cargo is distinct from p_reserva_id then select grupo_reserva_id into v_grupo_cargo from public.reservas where id=v_reserva_cargo;if v_grupo_id is null or v_grupo_cargo is null or v_grupo_id is distinct from v_grupo_cargo then raise exception 'El servicio no pertenece a la misma reserva o reserva conjunta';end if;end if;
  if v_saldo_cargo<=0 then raise exception 'Este servicio ya está pagado';end if;
  v_resumen:=public.haiku_saldo_favor_unidad(p_reserva_id);v_saldo_favor:=coalesce((v_resumen->>'saldo_a_favor')::bigint,0);if v_saldo_favor<=0 then raise exception 'La reserva no tiene saldo a favor disponible';end if;if p_monto is not null and p_monto<=0 then raise exception 'El monto a usar debe ser mayor que cero';end if;
  v_objetivo:=least(coalesce(p_monto,v_saldo_cargo),v_saldo_cargo,v_saldo_favor);v_restante:=v_objetivo;
  for v_fuente in
    with unidad as(select r.id from public.reservas r where(v_grupo_id is null and r.id=p_reserva_id)or(v_grupo_id is not null and r.grupo_reserva_id=v_grupo_id)),
    fuentes as(select p.id pago_id,p.reserva_id,p.pago_grupo_id,p.monto monto_original,p.medio_pago,p.fecha_pago,p.referencia_externa glosa,p.folio,p.codigo_autorizacion,p.bove bovtar,greatest(p.monto-coalesce((select sum(d.monto)from public.pagos d where d.pago_origen_id=p.id and d.tipo_movimiento='devolucion'and d.estado='confirmado'),0)-coalesce((select sum(pa.monto_aplicado)from public.pago_aplicaciones pa where pa.pago_id=p.id),0)+coalesce((select sum(pa2.monto_aplicado)from public.pago_aplicaciones pa2 join public.pagos d2 on d2.id=pa2.pago_id where d2.pago_origen_id=p.id and d2.tipo_movimiento='devolucion'and d2.estado='confirmado'),0),0)::bigint disponible from public.pagos p where p.reserva_id in(select id from unidad)and p.tipo_movimiento='pago'and p.estado='confirmado'and p.etapa_operativa in('abono','saldo'))
    select * from fuentes where disponible>0 order by fecha_pago,pago_id
  loop
    exit when v_restante<=0;perform 1 from public.pagos where id=v_fuente.pago_id for update;v_aplicar:=least(v_restante,v_fuente.disponible);
    insert into public.pago_aplicaciones(pago_id,cargo_id,monto_aplicado)values(v_fuente.pago_id,p_cargo_id,v_aplicar)on conflict(pago_id,cargo_id)do update set monto_aplicado=public.pago_aplicaciones.monto_aplicado+excluded.monto_aplicado;
    v_usadas:=v_usadas||jsonb_build_array(jsonb_build_object('pago_id',v_fuente.pago_id,'monto_usado',v_aplicar,'medio_pago',v_fuente.medio_pago,'fecha_pago',v_fuente.fecha_pago,'glosa',v_fuente.glosa,'folio',v_fuente.folio,'codigo_autorizacion',v_fuente.codigo_autorizacion,'bovtar',v_fuente.bovtar));v_restante:=v_restante-v_aplicar;
  end loop;
  if v_restante<>0 then raise exception 'No fue posible aplicar completamente el saldo a favor solicitado';end if;
  select coalesce(saldo_cargo,0)::bigint into v_saldo_cargo from public.vista_estado_cargos where cargo_id=p_cargo_id;v_resumen:=public.haiku_saldo_favor_unidad(p_reserva_id);
  return jsonb_build_object('ok',true,'cargo_id',p_cargo_id,'monto_usado',v_objetivo,'saldo_servicio_restante',v_saldo_cargo,'saldo_a_favor_restante',coalesce((v_resumen->>'saldo_a_favor')::bigint,0),'fuentes_usadas',v_usadas);
end;$function$;

create or replace function public.haiku_registrar_pago_checkin(p_reserva_id uuid,p_monto bigint,p_medio_pago text,p_glosa text default null,p_folio text default null,p_codigo_autorizacion text default null,p_manager_revisado boolean default false)
returns jsonb language plpgsql set search_path to 'public','private','pg_temp'
as $function$
declare v_saldo bigint:=0;v_resultado jsonb;v_pago_id uuid;v_credito jsonb;v_glosa text:=nullif(btrim(coalesce(p_glosa,'')),'');v_folio text:=nullif(btrim(coalesce(p_folio,'')),'');v_codaut text:=nullif(btrim(coalesce(p_codigo_autorizacion,'')),'');
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión para registrar el pago';end if;if not private.haiku_tiene_permiso('pagos.registrar')then raise exception 'Tu usuario no tiene permiso para registrar pagos';end if;if p_manager_revisado is not true then raise exception 'El pago debe ser revisado por Manager';end if;if not private.haiku_tiene_permiso('pagos.verificar')then raise exception 'Tu usuario no tiene permiso para validar pagos como Manager';end if;if p_monto is null or p_monto<=0 then raise exception 'El monto debe ser mayor que cero';end if;if p_medio_pago not in('transferencia','webpay_credito','webpay_debito','tarjeta_credito','tarjeta_debito','efectivo')then raise exception 'Medio de pago inválido';end if;perform 1 from public.reservas where id=p_reserva_id;if not found then raise exception 'Reserva no encontrada';end if;
  if p_medio_pago='transferencia'then if v_glosa is null then raise exception 'Transferencia requiere Glosa';end if;v_folio:=null;v_codaut:=null;elsif p_medio_pago in('webpay_credito','webpay_debito')then if v_codaut is null then raise exception 'WebPay requiere CodAut';end if;v_glosa:=null;v_folio:=null;elsif p_medio_pago in('tarjeta_credito','tarjeta_debito')then if v_folio is null or v_codaut is null then raise exception 'Pago con tarjeta en recepción requiere Folio y CodAut';end if;v_glosa:=null;else v_glosa:=null;v_folio:=null;v_codaut:=null;end if;
  v_resultado:=public.haiku_registrar_pago(p_reserva_id=>p_reserva_id,p_monto=>p_monto,p_medio_pago=>p_medio_pago,p_etapa_operativa=>'saldo',p_fecha_pago=>now(),p_folio=>v_folio,p_codigo_autorizacion=>v_codaut,p_bove=>null,p_referencia_externa=>v_glosa,p_observaciones=>'Pago de saldo Check-in de alojamiento registrado desde HAIKU',p_aplicaciones=>'[]'::jsonb,p_modo_aplicacion=>'alojamiento');v_pago_id:=nullif(v_resultado->>'pago_id','')::uuid;
  update public.pagos set verificado_por=auth.uid(),verificado_en=now(),datos_origen=coalesce(datos_origen,'{}'::jsonb)||jsonb_build_object('contexto','checkin','concepto','alojamiento','manager_revisado',true,'saldo_a_favor_generado',coalesce((v_resultado->>'sin_aplicar')::bigint,0))where id=v_pago_id;
  select coalesce(saldo_alojamiento,0)::bigint into v_saldo from public.vista_saldos_alojamiento_reserva where reserva_id=p_reserva_id;v_credito:=public.haiku_saldo_favor_unidad(p_reserva_id);
  return v_resultado||jsonb_build_object('saldo_restante',coalesce(v_saldo,0),'saldo_a_favor',coalesce((v_credito->>'saldo_a_favor')::bigint,0),'verificado_por',auth.uid(),'verificado_en',now());
end;$function$;

create or replace function public.haiku_registrar_pago_checkin_grupo(p_reserva_id uuid,p_monto bigint,p_medio_pago text,p_glosa text default null,p_folio text default null,p_codigo_autorizacion text default null,p_manager_revisado boolean default false)
returns jsonb language plpgsql set search_path to 'public','private','pg_temp'
as $function$
declare v_grupo_id uuid;v_glosa text:=nullif(btrim(coalesce(p_glosa,'')),'');v_folio text:=nullif(btrim(coalesce(p_folio,'')),'');v_codaut text:=nullif(btrim(coalesce(p_codigo_autorizacion,'')),'');v_resultado jsonb;v_pago_grupo_id uuid;v_finanzas jsonb;v_credito jsonb;
begin
  if auth.uid() is null then raise exception 'Debe iniciar sesión para registrar el pago';end if;if not private.haiku_tiene_permiso('pagos.registrar')then raise exception 'Tu usuario no tiene permiso para registrar pagos';end if;if p_manager_revisado is not true then raise exception 'El pago debe ser revisado por Manager';end if;if not private.haiku_tiene_permiso('pagos.verificar')then raise exception 'Tu usuario no tiene permiso para validar pagos como Manager';end if;if p_monto is null or p_monto<=0 then raise exception 'El monto debe ser mayor que cero';end if;if p_medio_pago not in('transferencia','webpay_credito','webpay_debito','tarjeta_credito','tarjeta_debito','efectivo')then raise exception 'Medio de pago inválido';end if;select grupo_reserva_id into v_grupo_id from public.reservas where id=p_reserva_id;if not found then raise exception 'Reserva no encontrada';end if;
  if v_grupo_id is null then return public.haiku_registrar_pago_checkin(p_reserva_id=>p_reserva_id,p_monto=>p_monto,p_medio_pago=>p_medio_pago,p_glosa=>p_glosa,p_folio=>p_folio,p_codigo_autorizacion=>p_codigo_autorizacion,p_manager_revisado=>p_manager_revisado);end if;
  if p_medio_pago='transferencia'then if v_glosa is null then raise exception 'Transferencia requiere Glosa';end if;v_folio:=null;v_codaut:=null;elsif p_medio_pago in('webpay_credito','webpay_debito')then if v_codaut is null then raise exception 'WebPay requiere CodAut';end if;v_glosa:=null;v_folio:=null;elsif p_medio_pago in('tarjeta_credito','tarjeta_debito')then if v_folio is null or v_codaut is null then raise exception 'Pago con tarjeta en recepción requiere Folio y CodAut';end if;v_glosa:=null;else v_glosa:=null;v_folio:=null;v_codaut:=null;end if;
  v_resultado:=public.haiku_registrar_pago_grupo(p_reserva_id=>p_reserva_id,p_monto=>p_monto,p_medio_pago=>p_medio_pago,p_etapa_operativa=>'saldo',p_fecha_pago=>now(),p_folio=>v_folio,p_codigo_autorizacion=>v_codaut,p_bove=>null,p_referencia_externa=>v_glosa,p_observaciones=>'Pago de saldo Check-in de reserva conjunta registrado desde HAIKU');v_pago_grupo_id:=nullif(v_resultado->>'pago_grupo_id','')::uuid;
  if v_pago_grupo_id is not null then update public.pagos set verificado_por=auth.uid(),verificado_en=now(),datos_origen=coalesce(datos_origen,'{}'::jsonb)||jsonb_build_object('contexto','checkin','concepto','alojamiento','manager_revisado',true,'reserva_conjunta',true,'saldo_a_favor_generado',coalesce((v_resultado->>'saldo_a_favor_generado')::bigint,0))where pago_grupo_id=v_pago_grupo_id;end if;
  v_finanzas:=public.haiku_finanzas_grupo(p_reserva_id);v_credito:=public.haiku_saldo_favor_unidad(p_reserva_id);return v_resultado||jsonb_build_object('saldo_restante',coalesce((v_finanzas->>'saldo_alojamiento')::bigint,0),'saldo_a_favor',coalesce((v_credito->>'saldo_a_favor')::bigint,0),'verificado_por',auth.uid(),'verificado_en',now());
end;$function$;

revoke execute on function public.haiku_saldo_favor_unidad(uuid) from public,anon;
revoke execute on function public.haiku_usar_saldo_favor(uuid,uuid,bigint) from public,anon;
grant execute on function public.haiku_saldo_favor_unidad(uuid) to authenticated;
grant execute on function public.haiku_usar_saldo_favor(uuid,uuid,bigint) to authenticated;
