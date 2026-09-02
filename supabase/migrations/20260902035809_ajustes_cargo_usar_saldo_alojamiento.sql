create or replace function public.haiku_resumen_ajustes(p_reserva_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $$
declare
    v_codigo text;
    v_titular text;
    v_total_original bigint := 0;
    v_total_actual bigint := 0;
    v_pagado bigint := 0;
    v_saldo bigint := 0;
    v_historial jsonb := '[]'::jsonb;
begin
    if auth.uid() is null then
        raise exception 'Debe iniciar sesión para revisar ajustes';
    end if;

    if not private.haiku_tiene_permiso('pagos.ver'::text) then
        raise exception 'No tiene permiso para revisar ajustes';
    end if;

    select r.codigo_haiku, r.titular_nombre
    into v_codigo, v_titular
    from public.reservas r
    where r.id = p_reserva_id;

    if not found then
        raise exception 'Reserva no encontrada';
    end if;

    select coalesce(sum(c.monto), 0)::bigint
    into v_total_original
    from public.cargos c
    where c.reserva_id = p_reserva_id
      and c.estado = 'activo'
      and c.tipo_cargo = 'alojamiento';

    select
        coalesce(v.total_alojamiento, 0),
        coalesce(v.pagado_alojamiento, 0),
        coalesce(v.saldo_alojamiento, 0)
    into v_total_actual, v_pagado, v_saldo
    from public.vista_saldos_alojamiento_reserva v
    where v.reserva_id = p_reserva_id;

    select coalesce(
        jsonb_agg(
            jsonb_build_object(
                'operacion_id', h.operacion_id,
                'tipo_ajuste', h.tipo_ajuste,
                'signo', h.signo,
                'porcentaje', h.porcentaje,
                'base_calculo', h.base_calculo,
                'monto', h.monto,
                'concepto', h.concepto,
                'observaciones', h.observaciones,
                'estado', h.estado,
                'creado_en', h.creado_en
            )
            order by h.creado_en desc
        ),
        '[]'::jsonb
    )
    into v_historial
    from (
        select
            ca.operacion_id,
            min(ca.tipo_ajuste) as tipo_ajuste,
            min(ca.signo) as signo,
            min(ca.porcentaje) as porcentaje,
            sum(ca.base_calculo)::bigint as base_calculo,
            sum(ca.monto)::bigint as monto,
            min(ca.concepto) as concepto,
            min(ca.observaciones) as observaciones,
            min(ca.estado) as estado,
            min(ca.creado_en) as creado_en
        from public.cargo_ajustes ca
        where ca.reserva_id = p_reserva_id
        group by ca.operacion_id
    ) h;

    return jsonb_build_object(
        'reserva_id', p_reserva_id,
        'codigo_haiku', v_codigo,
        'titular', v_titular,
        'total_alojamiento_original', v_total_original,
        'total_cargos_ajustado', v_total_actual,
        'total_pagado_neto', v_pagado,
        'saldo', v_saldo,
        'ajustes', v_historial
    );
end;
$$;

create or replace function public.haiku_aplicar_ajuste_reserva(
    p_reserva_id uuid,
    p_tipo_ajuste text,
    p_observaciones text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $$
declare
    v_tipo text := lower(btrim(coalesce(p_tipo_ajuste, '')));
    v_operacion_id uuid := gen_random_uuid();
    v_total_original bigint := 0;
    v_total_actual bigint := 0;
    v_pagado bigint := 0;
    v_total_ajuste bigint := 0;
    v_nuevo_total bigint := 0;
    v_signo smallint;
    v_porcentaje numeric(5,2);
    v_concepto text;
    v_cantidad integer := 0;
    v_indice integer := 0;
    v_acumulado bigint := 0;
    v_monto_fila bigint := 0;
    v_cargo record;
begin
    if auth.uid() is null then
        raise exception 'Debe iniciar sesión para ajustar cargos';
    end if;

    if not private.haiku_tiene_permiso('pagos.registrar'::text) then
        raise exception 'No tiene permiso para ajustar cargos';
    end if;

    if v_tipo not in ('iva_exento','cargo_cancelacion','cargo_modificacion') then
        raise exception 'Tipo de ajuste inválido';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(p_reserva_id::text, 0));

    if exists (
        select 1
        from public.cargo_ajustes ca
        where ca.reserva_id = p_reserva_id
          and ca.tipo_ajuste = v_tipo
          and ca.estado = 'activo'
    ) then
        raise exception 'Esta reserva ya tiene ese ajuste activo';
    end if;

    select
        coalesce(sum(c.monto), 0)::bigint,
        count(*)::integer
    into v_total_original, v_cantidad
    from public.cargos c
    where c.reserva_id = p_reserva_id
      and c.estado = 'activo'
      and c.tipo_cargo = 'alojamiento';

    if v_total_original <= 0 or v_cantidad <= 0 then
        raise exception 'La reserva no tiene cargos de alojamiento activos';
    end if;

    select
        coalesce(v.total_alojamiento, 0),
        coalesce(v.pagado_alojamiento, 0)
    into v_total_actual, v_pagado
    from public.vista_saldos_alojamiento_reserva v
    where v.reserva_id = p_reserva_id;

    if v_tipo = 'iva_exento' then
        v_signo := -1;
        v_porcentaje := 19.00;
        v_concepto := 'Exención IVA extranjero';
        v_total_ajuste := v_total_original
            - round(v_total_original::numeric / 1.19)::bigint;
        v_nuevo_total := v_total_actual - v_total_ajuste;

        if v_total_ajuste <= 0 then
            raise exception 'No fue posible calcular el IVA incluido';
        end if;

        if v_pagado > v_nuevo_total then
            raise exception 'No se puede aplicar la exención: los pagos de alojamiento registrados superarían el nuevo total';
        end if;
    else
        v_signo := 1;
        v_porcentaje := 10.00;
        v_total_ajuste := round(v_total_original::numeric * 0.10)::bigint;
        v_nuevo_total := v_total_actual + v_total_ajuste;

        if v_tipo = 'cargo_cancelacion' then
            v_concepto := 'Cargo 10% · Cancelación';
        else
            v_concepto := 'Cargo 10% · Modificación';
        end if;
    end if;

    for v_cargo in
        select c.id, c.monto
        from public.cargos c
        where c.reserva_id = p_reserva_id
          and c.estado = 'activo'
          and c.tipo_cargo = 'alojamiento'
        order by c.creado_en, c.id
        for update
    loop
        v_indice := v_indice + 1;

        if v_indice < v_cantidad then
            if v_tipo = 'iva_exento' then
                v_monto_fila := v_cargo.monto
                    - round(v_cargo.monto::numeric / 1.19)::bigint;
            else
                v_monto_fila := round(v_cargo.monto::numeric * 0.10)::bigint;
            end if;
            v_acumulado := v_acumulado + v_monto_fila;
        else
            v_monto_fila := v_total_ajuste - v_acumulado;
        end if;

        if v_monto_fila <= 0 then
            raise exception 'Monto de ajuste inválido';
        end if;

        insert into public.cargo_ajustes (
            operacion_id,
            reserva_id,
            cargo_id,
            tipo_ajuste,
            signo,
            porcentaje,
            base_calculo,
            monto,
            concepto,
            observaciones,
            creado_por
        ) values (
            v_operacion_id,
            p_reserva_id,
            v_cargo.id,
            v_tipo,
            v_signo,
            v_porcentaje,
            v_cargo.monto,
            v_monto_fila,
            v_concepto,
            nullif(btrim(coalesce(p_observaciones, '')), ''),
            auth.uid()
        );
    end loop;

    return jsonb_build_object(
        'operacion_id', v_operacion_id,
        'tipo_ajuste', v_tipo,
        'monto_ajuste', v_total_ajuste,
        'signo', v_signo,
        'nuevo_total', v_nuevo_total,
        'resumen', public.haiku_resumen_ajustes(p_reserva_id)
    );
end;
$$;

create or replace function public.haiku_anular_ajuste_reserva(p_operacion_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $$
declare
    v_reserva_id uuid;
    v_signo smallint;
    v_monto bigint;
    v_estado text;
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
        sum(ca.monto)::bigint,
        min(ca.estado)
    into v_reserva_id, v_signo, v_monto, v_estado
    from public.cargo_ajustes ca
    where ca.operacion_id = p_operacion_id;

    if v_reserva_id is null then
        raise exception 'Ajuste no encontrado';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(v_reserva_id::text, 0));

    if v_estado <> 'activo' then
        raise exception 'El ajuste ya está anulado';
    end if;

    select
        coalesce(v.total_alojamiento, 0),
        coalesce(v.pagado_alojamiento, 0)
    into v_total_actual, v_pagado
    from public.vista_saldos_alojamiento_reserva v
    where v.reserva_id = v_reserva_id;

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
        'nuevo_total', v_nuevo_total,
        'resumen', public.haiku_resumen_ajustes(v_reserva_id)
    );
end;
$$;
