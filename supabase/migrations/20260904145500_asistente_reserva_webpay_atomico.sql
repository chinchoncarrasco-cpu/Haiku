create or replace function public.haiku_crear_reserva_con_webpay(
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
  p_webpay_monto bigint default null,
  p_webpay_medio text default null,
  p_webpay_codaut text default null,
  p_webpay_fecha_pago timestamptz default now()
)
returns jsonb
language plpgsql
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_reserva jsonb;
  v_pago jsonb;
  v_asociacion jsonb;
  v_reserva_id uuid;
  v_pago_id uuid;
  v_codaut text := nullif(btrim(coalesce(p_webpay_codaut, '')), '');
begin
  if auth.uid() is null then
    raise exception 'Debe iniciar sesión para crear la reserva';
  end if;

  if p_webpay_monto is null or p_webpay_monto <= 0 then
    raise exception 'El monto WebPay debe ser mayor que cero';
  end if;

  if p_webpay_medio not in ('webpay_credito', 'webpay_debito') then
    raise exception 'El medio debe ser WebPay Crédito o WebPay Débito';
  end if;

  if v_codaut is null then
    raise exception 'WebPay requiere CodAut';
  end if;

  if exists (
    select 1
    from public.pagos
    where tipo_movimiento = 'pago'
      and medio_pago = p_webpay_medio
      and codigo_autorizacion = v_codaut
      and monto = p_webpay_monto
      and estado <> 'anulado'
  ) then
    raise exception 'Ya existe un WebPay no anulado con el mismo CodAut, medio y monto';
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

  v_pago := public.haiku_registrar_webpay_pendiente(
    p_webpay_monto,
    p_webpay_medio,
    v_codaut,
    p_titular_nombre,
    null,
    p_webpay_fecha_pago,
    p_cabana_numero,
    p_fecha_ingreso,
    null,
    'asistente_confirmado'
  );

  v_pago_id := (v_pago ->> 'pago_id')::uuid;

  v_asociacion := public.haiku_asociar_webpay(
    v_pago_id,
    v_reserva_id,
    'abono',
    true
  );

  return jsonb_build_object(
    'reserva', v_reserva,
    'pago', v_asociacion,
    'reserva_id', v_reserva_id,
    'pago_id', v_pago_id,
    'codigo_haiku', v_reserva ->> 'codigo_haiku',
    'saldo_restante', v_asociacion -> 'saldo_restante'
  );
end;
$function$;
