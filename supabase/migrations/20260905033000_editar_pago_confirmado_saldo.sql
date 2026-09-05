create or replace function public.haiku_editar_pago_confirmado_saldo(
    p_pago_id uuid,
    p_medio_pago text,
    p_glosa text default null,
    p_folio text default null,
    p_bovtar text default null,
    p_codigo_autorizacion text default null
)
returns jsonb
language plpgsql
security invoker
set search_path to 'public', 'private', 'pg_temp'
as $function$
declare
    v_pago public.pagos%rowtype;
    v_glosa text := nullif(btrim(coalesce(p_glosa,'')), '');
    v_folio text := nullif(btrim(coalesce(p_folio,'')), '');
    v_bovtar text := nullif(btrim(coalesce(p_bovtar,'')), '');
    v_codaut text := nullif(btrim(coalesce(p_codigo_autorizacion,'')), '');
    v_historial jsonb;
begin
    if auth.uid() is null then
        raise exception 'Debe iniciar sesión para editar el pago';
    end if;

    if not private.haiku_tiene_permiso('pagos.registrar')
       or not private.haiku_tiene_permiso('pagos.verificar') then
        raise exception 'Tu usuario no tiene permiso para editar pagos confirmados';
    end if;

    select *
      into v_pago
      from public.pagos
     where id = p_pago_id
       and tipo_movimiento = 'pago'
       and etapa_operativa = 'saldo'
       and estado = 'confirmado'
     for update;

    if not found then
        raise exception 'Pago confirmado de saldo no encontrado';
    end if;

    if p_medio_pago not in ('transferencia','webpay_credito','webpay_debito','tarjeta_credito','tarjeta_debito','efectivo') then
        raise exception 'Medio de pago inválido';
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
        if v_folio is null then raise exception 'Tarjeta requiere Folio'; end if;
        if v_bovtar is null then raise exception 'Tarjeta requiere BOVTAR'; end if;
        v_glosa := null;
        v_codaut := null;
    else
        v_glosa := null;
        v_folio := null;
        v_bovtar := null;
        v_codaut := null;
    end if;

    v_historial := coalesce(v_pago.datos_origen -> 'historial_ediciones', '[]'::jsonb)
        || jsonb_build_array(jsonb_build_object(
            'editado_en', now(),
            'editado_por', auth.uid(),
            'medio_pago_anterior', v_pago.medio_pago,
            'glosa_anterior', v_pago.referencia_externa,
            'folio_anterior', v_pago.folio,
            'bovtar_anterior', v_pago.bove,
            'codaut_anterior', v_pago.codigo_autorizacion,
            'verificado_por_anterior', v_pago.verificado_por,
            'verificado_en_anterior', v_pago.verificado_en
        ));

    update public.pagos
       set medio_pago = p_medio_pago,
           referencia_externa = v_glosa,
           folio = v_folio,
           bove = v_bovtar,
           codigo_autorizacion = v_codaut,
           verificado_por = auth.uid(),
           verificado_en = now(),
           actualizado_en = now(),
           datos_origen = jsonb_set(
               coalesce(v_pago.datos_origen, '{}'::jsonb),
               '{historial_ediciones}',
               v_historial,
               true
           )
     where id = p_pago_id;

    return jsonb_build_object(
        'pago_id', p_pago_id,
        'reserva_id', v_pago.reserva_id,
        'monto', v_pago.monto,
        'medio_pago', p_medio_pago,
        'glosa', v_glosa,
        'folio', v_folio,
        'bovtar', v_bovtar,
        'codigo_autorizacion', v_codaut,
        'editado_por', auth.uid(),
        'editado_en', now()
    );
end;
$function$;
