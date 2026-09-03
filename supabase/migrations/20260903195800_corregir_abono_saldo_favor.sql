-- HAIKU · Corrección de abono conservando saldo a favor
-- Al aumentar un abono, conserva las aplicaciones reales del movimiento anterior
-- y deja la diferencia sin aplicar para reutilizarla en servicios.

create or replace function public.haiku_corregir_abono_saldo_favor(
    p_pago_id uuid,
    p_monto bigint,
    p_medio_pago text,
    p_fecha_pago timestamptz,
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
    v_reserva_id uuid;
    v_pago_grupo_id uuid;
    v_nuevo_grupo_id uuid;
    v_estado text;
    v_tipo_movimiento text;
    v_etapa text;
    v_monto_anterior bigint := 0;
    v_aplicado_anterior bigint := 0;
    v_aplicaciones jsonb := '[]'::jsonb;
    v_resultado jsonb;
    v_pago_nuevo uuid;
    v_marca jsonb;
    v_titular text;
    v_documento text;
begin
    if auth.uid() is null then
        raise exception 'Debe iniciar sesión para corregir pagos';
    end if;
    if not private.haiku_tiene_permiso('pagos.registrar') then
        raise exception 'No tiene permiso para registrar pagos';
    end if;
    if not private.haiku_tiene_permiso('pagos.anular') then
        raise exception 'No tiene permiso para corregir pagos registrados';
    end if;
    if p_pago_id is null then
        raise exception 'Pago inválido';
    end if;
    if p_monto is null or p_monto <= 0 then
        raise exception 'El monto corregido debe ser mayor que cero';
    end if;
    if nullif(btrim(coalesce(p_medio_pago,'')),'') is null then
        raise exception 'Debe seleccionar un medio de pago';
    end if;
    if p_fecha_pago is null then
        raise exception 'Debe indicar la fecha real del pago';
    end if;

    select p.reserva_id,
           p.pago_grupo_id,
           p.estado,
           p.tipo_movimiento,
           p.etapa_operativa,
           r.titular_nombre,
           r.titular_numero_documento
      into v_reserva_id,
           v_pago_grupo_id,
           v_estado,
           v_tipo_movimiento,
           v_etapa,
           v_titular,
           v_documento
      from public.pagos p
      join public.reservas r on r.id = p.reserva_id
     where p.id = p_pago_id
     for update of p;

    if not found then
        raise exception 'Pago no encontrado';
    end if;
    if v_estado <> 'confirmado'
       or v_tipo_movimiento <> 'pago'
       or v_etapa <> 'abono' then
        raise exception 'Sólo se pueden corregir abonos confirmados';
    end if;

    if v_pago_grupo_id is not null then
        perform 1
          from public.pagos p
         where p.pago_grupo_id = v_pago_grupo_id
           and p.estado = 'confirmado'
           and p.tipo_movimiento = 'pago'
           and p.etapa_operativa = 'abono'
         for update;

        select coalesce(sum(p.monto),0)::bigint
          into v_monto_anterior
          from public.pagos p
         where p.pago_grupo_id = v_pago_grupo_id
           and p.estado = 'confirmado'
           and p.tipo_movimiento = 'pago'
           and p.etapa_operativa = 'abono';

        select coalesce(sum(x.monto),0)::bigint,
               coalesce(
                   jsonb_agg(
                       jsonb_build_object(
                           'cargo_id',x.cargo_id,
                           'monto',x.monto
                       ) order by x.cargo_id
                   ),
                   '[]'::jsonb
               )
          into v_aplicado_anterior,
               v_aplicaciones
          from (
              select pa.cargo_id,
                     sum(pa.monto_aplicado)::bigint as monto
                from public.pago_aplicaciones pa
                join public.pagos p on p.id = pa.pago_id
               where p.pago_grupo_id = v_pago_grupo_id
                 and p.estado = 'confirmado'
                 and p.tipo_movimiento = 'pago'
                 and p.etapa_operativa = 'abono'
               group by pa.cargo_id
          ) x;
    else
        select p.monto
          into v_monto_anterior
          from public.pagos p
         where p.id = p_pago_id;

        select coalesce(sum(pa.monto_aplicado),0)::bigint,
               coalesce(
                   jsonb_agg(
                       jsonb_build_object(
                           'cargo_id',pa.cargo_id,
                           'monto',pa.monto_aplicado
                       ) order by pa.cargo_id
                   ),
                   '[]'::jsonb
               )
          into v_aplicado_anterior,
               v_aplicaciones
          from public.pago_aplicaciones pa
         where pa.pago_id = p_pago_id;
    end if;

    if v_monto_anterior <= 0 then
        raise exception 'El abono ya no está disponible para corrección';
    end if;
    if p_monto < v_aplicado_anterior then
        raise exception
            'El monto corregido es menor que los $% ya aplicados. Usa la corrección normal para redistribuir el pago.',
            to_char(v_aplicado_anterior,'FM999G999G999');
    end if;

    if v_pago_grupo_id is not null then
        update public.pagos
           set estado = 'anulado',
               actualizado_en = now()
         where pago_grupo_id = v_pago_grupo_id
           and estado = 'confirmado'
           and tipo_movimiento = 'pago'
           and etapa_operativa = 'abono';
        v_nuevo_grupo_id := gen_random_uuid();
    else
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

    v_resultado := public.haiku_registrar_pago(
        p_reserva_id => v_reserva_id,
        p_monto => p_monto,
        p_medio_pago => p_medio_pago,
        p_etapa_operativa => 'abono',
        p_fecha_pago => p_fecha_pago,
        p_folio => p_folio,
        p_codigo_autorizacion => p_codigo_autorizacion,
        p_bove => p_bove,
        p_referencia_externa => p_referencia_externa,
        p_observaciones => p_observaciones,
        p_aplicaciones => v_aplicaciones,
        p_modo_aplicacion => 'ninguno'
    );

    v_pago_nuevo := (v_resultado->>'pago_id')::uuid;

    if v_nuevo_grupo_id is not null then
        update public.pagos
           set pago_grupo_id = v_nuevo_grupo_id,
               pagador_nombre = coalesce(v_titular,pagador_nombre),
               pagador_documento = coalesce(v_documento,pagador_documento)
         where id = v_pago_nuevo;
    end if;

    update public.pagos
       set datos_origen = coalesce(datos_origen,'{}'::jsonb) || jsonb_build_object(
           'correccion_saldo_a_favor',true,
           'monto_anterior',v_monto_anterior,
           'monto_corregido',p_monto,
           'aplicado_preservado',v_aplicado_anterior,
           'saldo_a_favor_generado',greatest(p_monto-v_aplicado_anterior,0),
           'corregido_en',now(),
           'corregido_por',auth.uid()
       ),
       actualizado_en = now()
     where id = v_pago_nuevo;

    v_marca := jsonb_build_object(
        'corregido',true,
        'modo','saldo_a_favor',
        'corregido_en',now(),
        'corregido_por',auth.uid(),
        'monto_anterior',v_monto_anterior,
        'monto_corregido',p_monto,
        'aplicado_preservado',v_aplicado_anterior,
        'pago_reemplazo_id',v_pago_nuevo
    );

    if v_pago_grupo_id is not null then
        update public.pagos
           set datos_origen = coalesce(datos_origen,'{}'::jsonb) || v_marca,
               actualizado_en = now()
         where pago_grupo_id = v_pago_grupo_id
           and estado = 'anulado';
    else
        update public.pagos
           set datos_origen = coalesce(datos_origen,'{}'::jsonb) || v_marca,
               actualizado_en = now()
         where id = p_pago_id
           and estado = 'anulado';
    end if;

    return jsonb_build_object(
        'pago_corregido_id',p_pago_id,
        'pago_nuevo_id',v_pago_nuevo,
        'pago_grupo_anterior_id',v_pago_grupo_id,
        'pago_grupo_nuevo_id',v_nuevo_grupo_id,
        'monto_anterior',v_monto_anterior,
        'monto_nuevo',p_monto,
        'aplicado_preservado',v_aplicado_anterior,
        'saldo_a_favor_generado',greatest(p_monto-v_aplicado_anterior,0),
        'reemplazo',v_resultado
    );
end;
$function$;

revoke execute on function public.haiku_corregir_abono_saldo_favor(
    uuid,bigint,text,timestamptz,text,text,text,text,text
) from public, anon;

grant execute on function public.haiku_corregir_abono_saldo_favor(
    uuid,bigint,text,timestamptz,text,text,text,text,text
) to authenticated;
