create or replace function public.haiku_anular_ajuste_reserva(p_operacion_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $function$
declare
    v_reserva_id uuid;
    v_grupo_id uuid;
    v_signo smallint;
    v_monto bigint := 0;
    v_todos_activos boolean := false;
    v_total_actual bigint := 0;
    v_pagado bigint := 0;
    v_nuevo_total bigint := 0;
begin
    if auth.uid() is null then
        raise exception 'Debe iniciar sesión para anular ajustes';
    end if;

    if not private.haiku_tiene_permiso('pagos.anular'::text) then
        raise exception 'No tiene permiso para anular ajustes';
    end if;

    select
        min(ca.reserva_id),
        min(ca.signo),
        coalesce(sum(ca.monto),0)::bigint,
        bool_and(ca.estado = 'activo')
      into v_reserva_id, v_signo, v_monto, v_todos_activos
      from public.cargo_ajustes ca
     where ca.operacion_id = p_operacion_id;

    if v_reserva_id is null then
        raise exception 'Ajuste no encontrado';
    end if;

    if not coalesce(v_todos_activos, false) then
        raise exception 'El ajuste ya está anulado';
    end if;

    select r.grupo_reserva_id
      into v_grupo_id
      from public.reservas r
     where r.id = v_reserva_id;

    perform pg_advisory_xact_lock(
        hashtextextended(coalesce(v_grupo_id::text, v_reserva_id::text), 0)
    );

    select
        coalesce(sum(ec.monto_ajustado),0)::bigint,
        coalesce(sum(ec.aplicado_neto),0)::bigint
      into v_total_actual, v_pagado
      from public.vista_estado_cargos ec
      join public.reservas r on r.id = ec.reserva_id
     where ec.estado = 'activo'
       and ec.tipo_cargo = 'alojamiento'
       and (
            (v_grupo_id is null and r.id = v_reserva_id)
            or
            (v_grupo_id is not null and r.grupo_reserva_id = v_grupo_id)
       );

    if v_signo = 1 then
        v_nuevo_total := v_total_actual - v_monto;
        if v_pagado > v_nuevo_total then
            raise exception 'No se puede anular: los pagos de alojamiento superarían el total resultante';
        end if;
    else
        v_nuevo_total := v_total_actual + v_monto;
    end if;

    update public.cargo_ajustes
       set estado = 'anulado',
           anulado_por = auth.uid(),
           anulado_en = now()
     where operacion_id = p_operacion_id
       and estado = 'activo';

    return jsonb_build_object(
        'operacion_id', p_operacion_id,
        'reserva_id', v_reserva_id,
        'grupo_reserva_id', v_grupo_id,
        'nuevo_total', v_nuevo_total,
        'resumen', public.haiku_resumen_ajustes_unidad(v_reserva_id)
    );
end;
$function$;