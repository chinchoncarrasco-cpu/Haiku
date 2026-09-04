create or replace function public.haiku_crear_reserva_con_transferencia(
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
  p_transferencia_monto bigint default null,
  p_transferencia_glosa text default null,
  p_transferencia_fecha_pago timestamptz default now()
)
returns jsonb
language plpgsql
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_reserva jsonb;
  v_pago jsonb;
  v_reserva_id uuid;
  v_pago_id uuid;
  v_glosa text := nullif(btrim(coalesce(p_transferencia_glosa, '')), '');
  v_saldo bigint := 0;
  v_credito jsonb;
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

  if p_transferencia_monto is null or p_transferencia_monto <= 0 then
    raise exception 'El monto de transferencia debe ser mayor que cero';
  end if;

  if v_glosa is null then
    raise exception 'Transferencia requiere Glosa';
  end if;

  if exists (
    select 1
    from public.pagos
    where tipo_movimiento = 'pago'
      and medio_pago = 'transferencia'
      and referencia_externa = v_glosa
      and monto = p_transferencia_monto
      and estado <> 'anulado'
  ) then
    raise exception 'Ya existe una transferencia no anulada con la misma Glosa y monto';
  end if;

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

  v_pago := public.haiku_registrar_pago(
    p_reserva_id => v_reserva_id,
    p_monto => p_transferencia_monto,
    p_medio_pago => 'transferencia',
    p_etapa_operativa => 'abono',
    p_fecha_pago => coalesce(p_transferencia_fecha_pago, now()),
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
           'contexto', 'asistente_reserva',
           'concepto', 'alojamiento',
           'manager_revisado', true,
           'saldo_a_favor_generado', coalesce((v_pago ->> 'sin_aplicar')::bigint, 0)
         )
   where id = v_pago_id;

  select coalesce(saldo_alojamiento, 0)::bigint
    into v_saldo
  from public.vista_saldos_alojamiento_reserva
  where reserva_id = v_reserva_id;

  v_credito := public.haiku_saldo_favor_unidad(v_reserva_id);

  return jsonb_build_object(
    'reserva', v_reserva,
    'pago', v_pago,
    'reserva_id', v_reserva_id,
    'pago_id', v_pago_id,
    'codigo_haiku', v_reserva ->> 'codigo_haiku',
    'saldo_restante', coalesce(v_saldo, 0),
    'saldo_a_favor', coalesce((v_credito ->> 'saldo_a_favor')::bigint, 0)
  );
end;
$function$;

revoke all on function public.haiku_crear_reserva_con_transferencia(text, smallint, date, date, smallint, smallint, smallint, text, text, text, jsonb, jsonb, text, bigint, text, timestamptz) from public;
grant execute on function public.haiku_crear_reserva_con_transferencia(text, smallint, date, date, smallint, smallint, smallint, text, text, text, jsonb, jsonb, text, bigint, text, timestamptz) to authenticated;
