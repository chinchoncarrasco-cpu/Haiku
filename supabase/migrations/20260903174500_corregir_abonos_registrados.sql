create or replace function public.haiku_corregir_abono(
    p_pago_id uuid,
    p_monto bigint,
    p_medio_pago text,
    p_fecha_pago timestamp with time zone,
    p_folio text default null,
    p_codigo_autorizacion text default null,
    p_bove text default null,
    p_referencia_externa text default null,
    p_observaciones text default null
)
returns jsonb
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
    v_reserva_id uuid;
    v_pago_grupo_id uuid;
    v_estado text;
    v_tipo_movimiento text;
    v_etapa_operativa text;
    v_monto_anterior bigint := 0;
    v_resultado jsonb;
    v_marca jsonb;
begin
    if auth.uid() is null then
        raise exception 'Debe iniciar sesión para corregir pagos';
    end if;

    if not private.haiku_tiene_permiso('pagos.registrar'::text) then
        raise exception 'No tiene permiso para registrar pagos';
    end if;

    if not private.haiku_tiene_permiso('pagos.anular'::text) then
        raise exception 'No tiene permiso para corregir pagos registrados';
    end if;

    if p_pago_id is null then
        raise exception 'Pago inválido';
    end if;

    if p_monto is null or p_monto <= 0 then
        raise exception 'El monto corregido debe ser mayor que cero';
    end if;

    if nullif(btrim(coalesce(p_medio_pago,'')), '') is null then
        raise exception 'Debe seleccionar un medio de pago';
    end if;

    if p_fecha_pago is null then
        raise exception 'Debe indicar la fecha real del pago';
    end if;

    select p.reserva_id,
           p.pago_grupo_id,
           p.estado,
           p.tipo_movimiento,
           p.etapa_operativa
      into v_reserva_id,
           v_pago_grupo_id,
           v_estado,
           v_tipo_movimiento,
           v_etapa_operativa
      from public.pagos p
     where p.id = p_pago_id
     for update;

    if not found then
        raise exception 'Pago no encontrado';
    end if;

    if v_estado <> 'confirmado'
       or v_tipo_movimiento <> 'pago'
       or v_etapa_operativa <> 'abono' then
        raise exception 'Sólo se pueden corregir abonos confirmados';
    end if;

    if v_pago_grupo_id is not null then
        perform 1
          from public.pagos p
         where p.pago_grupo_id = v_pago_grupo_id
         for update;

        select coalesce(sum(p.monto),0)::bigint
          into v_monto_anterior
          from public.pagos p
         where p.pago_grupo_id = v_pago_grupo_id
           and p.estado = 'confirmado'
           and p.tipo_movimiento = 'pago'
           and p.etapa_operativa = 'abono';

        if v_monto_anterior <= 0 then
            raise exception 'El pago conjunto ya no está disponible para corrección';
        end if;

        update public.pagos
           set estado = 'anulado',
               actualizado_en = now()
         where pago_grupo_id = v_pago_grupo_id
           and estado = 'confirmado'
           and tipo_movimiento = 'pago'
           and etapa_operativa = 'abono';
    else
        v_monto_anterior := (
            select p.monto
              from public.pagos p
             where p.id = p_pago_id
        );

        update public.pagos
           set estado = 'anulado',
               actualizado_en = now()
         where id = p_pago_id
           and estado = 'confirmado'
           and tipo_movimiento = 'pago'
           and etapa_operativa = 'abono';

        if not found then
            raise exception 'El abono ya no está disponible para corrección';
        end if;
    end if;

    v_resultado := public.haiku_registrar_pago_grupo(
        p_reserva_id => v_reserva_id,
        p_monto => p_monto,
        p_medio_pago => p_medio_pago,
        p_etapa_operativa => 'abono',
        p_fecha_pago => p_fecha_pago,
        p_folio => p_folio,
        p_codigo_autorizacion => p_codigo_autorizacion,
        p_bove => p_bove,
        p_referencia_externa => p_referencia_externa,
        p_observaciones => p_observaciones
    );

    v_marca := jsonb_build_object(
        'corregido', true,
        'corregido_en', now(),
        'corregido_por', auth.uid(),
        'monto_anterior', v_monto_anterior,
        'monto_corregido', p_monto,
        'reemplazo', v_resultado
    );

    if v_pago_grupo_id is not null then
        update public.pagos
           set datos_origen = coalesce(datos_origen, '{}'::jsonb) || v_marca,
               actualizado_en = now()
         where pago_grupo_id = v_pago_grupo_id
           and estado = 'anulado';
    else
        update public.pagos
           set datos_origen = coalesce(datos_origen, '{}'::jsonb) || v_marca,
               actualizado_en = now()
         where id = p_pago_id
           and estado = 'anulado';
    end if;

    return jsonb_build_object(
        'pago_corregido_id', p_pago_id,
        'pago_grupo_anterior_id', v_pago_grupo_id,
        'monto_anterior', v_monto_anterior,
        'monto_nuevo', p_monto,
        'reemplazo', v_resultado
    );
end;
$function$;

grant execute on function public.haiku_corregir_abono(uuid,bigint,text,timestamp with time zone,text,text,text,text,text) to authenticated;
revoke execute on function public.haiku_corregir_abono(uuid,bigint,text,timestamp with time zone,text,text,text,text,text) from anon;