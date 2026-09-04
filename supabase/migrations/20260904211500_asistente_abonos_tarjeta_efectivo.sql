create or replace function public.haiku_crear_reserva_con_abonos(
  p_titular_nombre text,
  p_cabana_numero smallint,
  p_fecha_ingreso date,
  p_fecha_salida date,
  p_adultos smallint default 1,
  p_ninos smallint default 0,
  p_mascotas smallint default 0,
  p_correo_contacto text default null,
  p_telefono_contacto text default null,
  p_observaciones text default null,
  p_tarifas jsonb default '{}'::jsonb,
  p_acompanantes jsonb default '[]'::jsonb,
  p_cloudbeds_id text default null,
  p_pagos jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_reserva jsonb;
  v_reserva_id uuid;
  v_item jsonb;
  v_medio text;
  v_monto bigint;
  v_fecha timestamptz;
  v_glosa text;
  v_codaut text;
  v_folio text;
  v_bovtar text;
  v_pago jsonb;
  v_asociacion jsonb;
  v_pago_id uuid;
  v_resultados jsonb := '[]'::jsonb;
  v_saldo bigint := 0;
  v_credito jsonb;
  v_indice integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Debe iniciar sesión para crear la reserva';
  end if;

  if not private.haiku_tiene_permiso('reservas.crear') then
    raise exception 'Tu usuario no tiene permiso para crear reservas';
  end if;

  if not private.haiku_tiene_permiso('pagos.registrar') then
    raise exception 'Tu usuario no tiene permiso para registrar pagos';
  end if;

  if not private.haiku_tiene_permiso('pagos.verificar') then
    raise exception 'Tu usuario no tiene permiso para verificar pagos';
  end if;

  if jsonb_typeof(coalesce(p_pagos, '[]'::jsonb)) <> 'array' then
    raise exception 'Los abonos deben enviarse como arreglo';
  end if;

  if jsonb_array_length(coalesce(p_pagos, '[]'::jsonb)) < 1 then
    raise exception 'Debe existir al menos un abono';
  end if;

  if jsonb_array_length(p_pagos) > 10 then
    raise exception 'Se admiten como máximo 10 abonos por reserva';
  end if;

  for v_item in select value from jsonb_array_elements(p_pagos)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Cada abono debe ser un objeto';
    end if;

    v_medio := lower(btrim(coalesce(v_item ->> 'medio', '')));
    if v_medio not in (
      'transferencia',
      'webpay_credito',
      'webpay_debito',
      'tarjeta_credito',
      'tarjeta_debito',
      'efectivo'
    ) then
      raise exception 'Medio de abono no admitido por el asistente: %', coalesce(v_medio, '');
    end if;

    if coalesce(v_item ->> 'monto', '') !~ '^[0-9]+$' then
      raise exception 'Cada abono requiere un monto entero válido';
    end if;
    v_monto := (v_item ->> 'monto')::bigint;
    if v_monto <= 0 then
      raise exception 'Cada abono debe ser mayor que cero';
    end if;

    begin
      v_fecha := nullif(v_item ->> 'fecha_pago', '')::timestamptz;
    exception when others then
      raise exception 'Cada abono requiere una fecha válida';
    end;
    if v_fecha is null then
      raise exception 'Cada abono requiere una fecha válida';
    end if;

    if v_medio = 'transferencia' then
      v_glosa := nullif(btrim(coalesce(v_item ->> 'glosa', '')), '');
      if v_glosa is null then
        raise exception 'Cada transferencia requiere Glosa';
      end if;
    elsif v_medio in ('webpay_credito', 'webpay_debito') then
      v_codaut := nullif(btrim(coalesce(v_item ->> 'codaut', '')), '');
      if v_codaut is null then
        raise exception 'Cada WebPay requiere CodAut';
      end if;
    elsif v_medio in ('tarjeta_credito', 'tarjeta_debito') then
      v_folio := nullif(btrim(coalesce(v_item ->> 'folio', '')), '');
      v_bovtar := nullif(btrim(coalesce(v_item ->> 'bovtar', '')), '');
      if v_folio is null then
        raise exception 'Cada pago con tarjeta requiere Folio';
      end if;
      if v_bovtar is null then
        raise exception 'Cada pago con tarjeta requiere BOVTAR';
      end if;
    end if;
  end loop;

  v_reserva := public.haiku_crear_reserva(
    p_titular_nombre,
    p_cabana_numero,
    p_fecha_ingreso,
    p_fecha_salida,
    p_adultos,
    p_ninos,
    p_mascotas,
    p_correo_contacto,
    p_telefono_contacto,
    null,
    p_observaciones,
    p_tarifas,
    p_acompanantes,
    'alojamiento',
    p_cloudbeds_id
  );

  v_reserva_id := (v_reserva ->> 'reserva_id')::uuid;

  for v_item in select value from jsonb_array_elements(p_pagos)
  loop
    v_indice := v_indice + 1;
    v_medio := lower(btrim(v_item ->> 'medio'));
    v_monto := (v_item ->> 'monto')::bigint;
    v_fecha := (v_item ->> 'fecha_pago')::timestamptz;
    v_glosa := nullif(btrim(coalesce(v_item ->> 'glosa', '')), '');
    v_codaut := nullif(btrim(coalesce(v_item ->> 'codaut', '')), '');
    v_folio := nullif(btrim(coalesce(v_item ->> 'folio', '')), '');
    v_bovtar := nullif(btrim(coalesce(v_item ->> 'bovtar', '')), '');

    if v_medio = 'transferencia' then
      v_pago := public.haiku_registrar_pago(
        p_reserva_id => v_reserva_id,
        p_monto => v_monto,
        p_medio_pago => 'transferencia',
        p_etapa_operativa => 'abono',
        p_fecha_pago => v_fecha,
        p_folio => null,
        p_codigo_autorizacion => null,
        p_bove => null,
        p_referencia_externa => v_glosa,
        p_observaciones => 'Transferencia confirmada desde asistente HAIKU',
        p_aplicaciones => '[]'::jsonb,
        p_modo_aplicacion => 'alojamiento'
      );

      v_pago_id := (v_pago ->> 'pago_id')::uuid;

      update public.pagos
         set verificado_por = auth.uid(),
             verificado_en = now(),
             pagador_nombre = coalesce(p_titular_nombre, pagador_nombre),
             datos_origen = coalesce(datos_origen, '{}'::jsonb) || jsonb_build_object(
               'contexto', 'asistente_reserva_multiabono',
               'concepto', 'alojamiento',
               'manager_revisado', true,
               'indice_abono', v_indice,
               'saldo_a_favor_generado', coalesce((v_pago ->> 'sin_aplicar')::bigint, 0)
             )
       where id = v_pago_id;

      v_resultados := v_resultados || jsonb_build_array(jsonb_build_object(
        'indice', v_indice,
        'pago_id', v_pago_id,
        'medio', 'transferencia',
        'monto', v_monto,
        'glosa', v_glosa,
        'aplicado', coalesce((v_pago ->> 'aplicado')::bigint, 0),
        'sin_aplicar', coalesce((v_pago ->> 'sin_aplicar')::bigint, 0)
      ));

    elsif v_medio in ('webpay_credito', 'webpay_debito') then
      if exists (
        select 1
        from public.pagos
        where tipo_movimiento = 'pago'
          and medio_pago = v_medio
          and codigo_autorizacion = v_codaut
          and monto = v_monto
          and estado <> 'anulado'
      ) then
        raise exception 'Ya existe un WebPay no anulado con el mismo CodAut, medio y monto';
      end if;

      v_pago := public.haiku_registrar_webpay_pendiente(
        v_monto,
        v_medio,
        v_codaut,
        p_titular_nombre,
        null,
        v_fecha,
        p_cabana_numero,
        p_fecha_ingreso,
        null,
        'asistente_confirmado_multiabono'
      );

      v_pago_id := (v_pago ->> 'pago_id')::uuid;
      v_asociacion := public.haiku_asociar_webpay(
        v_pago_id,
        v_reserva_id,
        'abono',
        true
      );

      v_resultados := v_resultados || jsonb_build_array(jsonb_build_object(
        'indice', v_indice,
        'pago_id', v_pago_id,
        'medio', v_medio,
        'monto', v_monto,
        'codaut', v_codaut,
        'saldo_restante', v_asociacion -> 'saldo_restante'
      ));

    else
      if v_medio in ('tarjeta_credito', 'tarjeta_debito') and exists (
        select 1
        from public.pagos
        where tipo_movimiento = 'pago'
          and medio_pago = v_medio
          and folio = v_folio
          and bove = v_bovtar
          and monto = v_monto
          and estado <> 'anulado'
      ) then
        raise exception 'Ya existe un pago con tarjeta no anulado con el mismo Folio, BOVTAR, medio y monto';
      end if;

      v_pago := public.haiku_registrar_pago(
        p_reserva_id => v_reserva_id,
        p_monto => v_monto,
        p_medio_pago => v_medio,
        p_etapa_operativa => 'abono',
        p_fecha_pago => v_fecha,
        p_folio => case when v_medio in ('tarjeta_credito', 'tarjeta_debito') then v_folio else null end,
        p_codigo_autorizacion => null,
        p_bove => case when v_medio in ('tarjeta_credito', 'tarjeta_debito') then v_bovtar else null end,
        p_referencia_externa => null,
        p_observaciones => case
          when v_medio = 'efectivo' then 'Efectivo confirmado desde asistente HAIKU'
          else 'Tarjeta confirmada desde asistente HAIKU'
        end,
        p_aplicaciones => '[]'::jsonb,
        p_modo_aplicacion => 'alojamiento'
      );

      v_pago_id := (v_pago ->> 'pago_id')::uuid;

      update public.pagos
         set verificado_por = auth.uid(),
             verificado_en = now(),
             pagador_nombre = coalesce(p_titular_nombre, pagador_nombre),
             datos_origen = coalesce(datos_origen, '{}'::jsonb) || jsonb_build_object(
               'contexto', 'asistente_reserva_multiabono',
               'concepto', 'alojamiento',
               'manager_revisado', true,
               'indice_abono', v_indice,
               'saldo_a_favor_generado', coalesce((v_pago ->> 'sin_aplicar')::bigint, 0)
             )
       where id = v_pago_id;

      v_resultados := v_resultados || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'indice', v_indice,
        'pago_id', v_pago_id,
        'medio', v_medio,
        'monto', v_monto,
        'folio', case when v_medio in ('tarjeta_credito', 'tarjeta_debito') then v_folio else null end,
        'bovtar', case when v_medio in ('tarjeta_credito', 'tarjeta_debito') then v_bovtar else null end,
        'aplicado', coalesce((v_pago ->> 'aplicado')::bigint, 0),
        'sin_aplicar', coalesce((v_pago ->> 'sin_aplicar')::bigint, 0)
      )));
    end if;
  end loop;

  select coalesce(saldo_alojamiento, 0)::bigint
    into v_saldo
  from public.vista_saldos_alojamiento_reserva
  where reserva_id = v_reserva_id;

  v_credito := public.haiku_saldo_favor_unidad(v_reserva_id);

  return jsonb_build_object(
    'reserva', v_reserva,
    'reserva_id', v_reserva_id,
    'codigo_haiku', v_reserva ->> 'codigo_haiku',
    'pagos', v_resultados,
    'cantidad_pagos', jsonb_array_length(v_resultados),
    'saldo_restante', coalesce(v_saldo, 0),
    'saldo_a_favor', coalesce((v_credito ->> 'saldo_a_favor')::bigint, 0)
  );
end;
$function$;

revoke all on function public.haiku_crear_reserva_con_abonos(text, smallint, date, date, smallint, smallint, smallint, text, text, text, jsonb, jsonb, text, jsonb) from public;
grant execute on function public.haiku_crear_reserva_con_abonos(text, smallint, date, date, smallint, smallint, smallint, text, text, text, jsonb, jsonb, text, jsonb) to authenticated;