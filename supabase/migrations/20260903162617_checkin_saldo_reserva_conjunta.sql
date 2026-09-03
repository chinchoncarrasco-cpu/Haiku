create or replace function public.haiku_registrar_pago_checkin_grupo(
    p_reserva_id uuid,
    p_monto bigint,
    p_medio_pago text,
    p_glosa text default null,
    p_folio text default null,
    p_codigo_autorizacion text default null,
    p_manager_revisado boolean default false
)
returns jsonb
language plpgsql
set search_path to 'public','private','pg_temp'
as $function$
declare
    v_grupo_id uuid;
    v_glosa text := nullif(btrim(coalesce(p_glosa,'')), '');
    v_folio text := nullif(btrim(coalesce(p_folio,'')), '');
    v_codaut text := nullif(btrim(coalesce(p_codigo_autorizacion,'')), '');
    v_resultado jsonb;
    v_pago_grupo_id uuid;
    v_finanzas jsonb;
begin
    if auth.uid() is null then raise exception 'Debe iniciar sesión para registrar el pago'; end if;
    if not private.haiku_tiene_permiso('pagos.registrar') then raise exception 'Tu usuario no tiene permiso para registrar pagos'; end if;
    if p_manager_revisado is not true then raise exception 'El pago debe ser revisado por Manager'; end if;
    if not private.haiku_tiene_permiso('pagos.verificar') then raise exception 'Tu usuario no tiene permiso para validar pagos como Manager'; end if;
    if p_monto is null or p_monto <= 0 then raise exception 'El monto debe ser mayor que cero'; end if;
    if p_medio_pago not in ('transferencia','webpay_credito','webpay_debito','tarjeta_credito','tarjeta_debito','efectivo') then raise exception 'Medio de pago inválido'; end if;

    select grupo_reserva_id into v_grupo_id from public.reservas where id = p_reserva_id;
    if not found then raise exception 'Reserva no encontrada'; end if;

    if v_grupo_id is null then
        return public.haiku_registrar_pago_checkin(
            p_reserva_id => p_reserva_id,
            p_monto => p_monto,
            p_medio_pago => p_medio_pago,
            p_glosa => p_glosa,
            p_folio => p_folio,
            p_codigo_autorizacion => p_codigo_autorizacion,
            p_manager_revisado => p_manager_revisado
        );
    end if;

    if p_medio_pago = 'transferencia' then
        if v_glosa is null then raise exception 'Transferencia requiere Glosa'; end if;
        v_folio := null; v_codaut := null;
    elsif p_medio_pago in ('webpay_credito','webpay_debito') then
        if v_codaut is null then raise exception 'WebPay requiere CodAut'; end if;
        v_glosa := null; v_folio := null;
    elsif p_medio_pago in ('tarjeta_credito','tarjeta_debito') then
        if v_folio is null or v_codaut is null then raise exception 'Pago con tarjeta en recepción requiere Folio y CodAut'; end if;
        v_glosa := null;
    else
        v_glosa := null; v_folio := null; v_codaut := null;
    end if;

    v_resultado := public.haiku_registrar_pago_grupo(
        p_reserva_id => p_reserva_id,
        p_monto => p_monto,
        p_medio_pago => p_medio_pago,
        p_etapa_operativa => 'saldo',
        p_fecha_pago => now(),
        p_folio => v_folio,
        p_codigo_autorizacion => v_codaut,
        p_bove => null,
        p_referencia_externa => v_glosa,
        p_observaciones => 'Pago de saldo Check-in de reserva conjunta registrado desde HAIKU'
    );

    v_pago_grupo_id := nullif(v_resultado->>'pago_grupo_id','')::uuid;
    if v_pago_grupo_id is not null then
        update public.pagos
           set verificado_por = auth.uid(),
               verificado_en = now(),
               datos_origen = coalesce(datos_origen,'{}'::jsonb) || jsonb_build_object(
                    'contexto','checkin','concepto','alojamiento','manager_revisado',true,'reserva_conjunta',true
               )
         where pago_grupo_id = v_pago_grupo_id;
    end if;

    v_finanzas := public.haiku_finanzas_grupo(p_reserva_id);
    return v_resultado || jsonb_build_object(
        'saldo_restante', coalesce((v_finanzas->>'saldo_alojamiento')::bigint,0),
        'verificado_por', auth.uid(), 'verificado_en', now()
    );
end;
$function$;

create or replace function public.haiku_registrar_bove_reserva_grupo(p_reserva_id uuid, p_bove text)
returns jsonb
language plpgsql
set search_path to 'public','private','pg_temp'
as $function$
declare
    v_grupo_id uuid;
    v_bove text := nullif(btrim(coalesce(p_bove,'')), '');
    v_saldo bigint := 0;
    v_total bigint := 0;
    v_cantidad integer := 0;
begin
    if auth.uid() is null then raise exception 'Debe iniciar sesión para registrar el BOVE'; end if;
    if not private.haiku_tiene_permiso('pagos.verificar') then raise exception 'Tu usuario no tiene permiso para registrar el BOVE'; end if;
    if v_bove is null then raise exception 'Ingresa el BOVE de la reserva'; end if;

    select grupo_reserva_id into v_grupo_id from public.reservas where id = p_reserva_id;
    if not found then raise exception 'Reserva no encontrada'; end if;
    if v_grupo_id is null then return public.haiku_registrar_bove_reserva(p_reserva_id, p_bove); end if;

    select coalesce(sum(v.total_alojamiento),0)::bigint,
           coalesce(sum(v.saldo_alojamiento),0)::bigint,
           count(*)::integer
      into v_total, v_saldo, v_cantidad
      from public.reservas r
      join public.vista_saldos_alojamiento_reserva v on v.reserva_id = r.id
     where r.grupo_reserva_id = v_grupo_id;

    if v_cantidad = 0 then raise exception 'No se encontraron alojamientos en la reserva conjunta'; end if;
    if v_saldo <> 0 then raise exception 'El BOVE de alojamiento sólo puede registrarse cuando la reserva conjunta está pagada al 100%%'; end if;

    update public.reservas
       set bove_cierre = v_bove,
           bove_cierre_registrado_por = auth.uid(),
           bove_cierre_registrado_en = now(),
           actualizado_en = now()
     where grupo_reserva_id = v_grupo_id;

    return jsonb_build_object(
        'grupo_reserva_id', v_grupo_id, 'bove', v_bove,
        'registrado_por', auth.uid(), 'registrado_en', now(),
        'total_alojamiento', v_total, 'cantidad_reservas', v_cantidad
    );
end;
$function$;