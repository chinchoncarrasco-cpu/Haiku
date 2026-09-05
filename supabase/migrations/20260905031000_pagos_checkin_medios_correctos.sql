create or replace function public.haiku_registrar_pago_checkin_v2(
  p_reserva_id uuid,
  p_monto bigint,
  p_medio_pago text,
  p_glosa text default null,
  p_folio text default null,
  p_bovtar text default null,
  p_codigo_autorizacion text default null,
  p_manager_revisado boolean default false
)
returns jsonb
language plpgsql
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
  v_saldo bigint := 0;
  v_resultado jsonb;
  v_pago_id uuid;
  v_credito jsonb;
  v_glosa text := nullif(btrim(coalesce(p_glosa,'')), '');
  v_folio text := nullif(btrim(coalesce(p_folio,'')), '');
  v_bovtar text := nullif(btrim(coalesce(p_bovtar,'')), '');
  v_codaut text := nullif(btrim(coalesce(p_codigo_autorizacion,'')), '');
begin
  if auth.uid() is null then
    raise exception 'Debe iniciar sesión para registrar el pago';
  end if;

  if not private.haiku_tiene_permiso('pagos.registrar') then
    raise exception 'Tu usuario no tiene permiso para registrar pagos';
  end if;

  if p_manager_revisado is not true then
    raise exception 'El pago debe ser revisado por Manager';
  end if;

  if not private.haiku_tiene_permiso('pagos.verificar') then
    raise exception 'Tu usuario no tiene permiso para validar pagos como Manager';
  end if;

  if p_monto is null or p_monto <= 0 then
    raise exception 'El monto debe ser mayor que cero';
  end if;

  if p_medio_pago not in ('transferencia','webpay_credito','webpay_debito','tarjeta_credito','tarjeta_debito','efectivo') then
    raise exception 'Medio de pago inválido';
  end if;

  perform 1 from public.reservas where id = p_reserva_id;
  if not found then
    raise exception 'Reserva no encontrada';
  end if;

  if p_medio_pago = 'transferencia' then
    if v_glosa is null then raise exception 'Transferencia requiere Glosa'; end if;
    v_folio := null;
    v_bovtar := null;
    v_codaut := null;
  elsif p_medio_pago in ('webpay_credito','webpay_debito') then
    if v_codaut is null then raise exception 'WebPay requiere CodAut'; end if;
    v_glosa := null;
    v_folio := null;
    v_bovtar := null;
  elsif p_medio_pago in ('tarjeta_credito','tarjeta_debito') then
    if v_folio is null or v_bovtar is null then
      raise exception 'Pago con tarjeta requiere BOVTAR y Folio';
    end if;
    v_glosa := null;
    v_codaut := null;
  else
    v_glosa := null;
    v_folio := null;
    v_bovtar := null;
    v_codaut := null;
  end if;

  v_resultado := public.haiku_registrar_pago(
    p_reserva_id => p_reserva_id,
    p_monto => p_monto,
    p_medio_pago => p_medio_pago,
    p_etapa_operativa => 'saldo',
    p_fecha_pago => now(),
    p_folio => v_folio,
    p_codigo_autorizacion => v_codaut,
    p_bove => v_bovtar,
    p_referencia_externa => v_glosa,
    p_observaciones => 'Pago de saldo Check-in de alojamiento registrado desde HAIKU',
    p_aplicaciones => '[]'::jsonb,
    p_modo_aplicacion => 'alojamiento'
  );

  v_pago_id := nullif(v_resultado ->> 'pago_id','')::uuid;

  update public.pagos
     set verificado_por = auth.uid(),
         verificado_en = now(),
         datos_origen = coalesce(datos_origen,'{}'::jsonb) || jsonb_build_object(
           'contexto','checkin',
           'concepto','alojamiento',
           'manager_revisado',true,
           'saldo_a_favor_generado',coalesce((v_resultado->>'sin_aplicar')::bigint,0)
         )
   where id = v_pago_id;

  select coalesce(saldo_alojamiento,0)::bigint
    into v_saldo
  from public.vista_saldos_alojamiento_reserva
  where reserva_id = p_reserva_id;

  v_credito := public.haiku_saldo_favor_unidad(p_reserva_id);

  return v_resultado || jsonb_build_object(
    'saldo_restante', coalesce(v_saldo,0),
    'saldo_a_favor', coalesce((v_credito->>'saldo_a_favor')::bigint,0),
    'verificado_por', auth.uid(),
    'verificado_en', now()
  );
end;
$function$;

revoke all on function public.haiku_registrar_pago_checkin_v2(uuid,bigint,text,text,text,text,text,boolean) from public;
revoke all on function public.haiku_registrar_pago_checkin_v2(uuid,bigint,text,text,text,text,text,boolean) from anon;
grant execute on function public.haiku_registrar_pago_checkin_v2(uuid,bigint,text,text,text,text,text,boolean) to authenticated;
