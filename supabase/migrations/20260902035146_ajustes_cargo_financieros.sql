create table if not exists public.cargo_ajustes (
    id uuid primary key default gen_random_uuid(),
    operacion_id uuid not null,
    reserva_id uuid not null references public.reservas(id) on delete restrict,
    cargo_id uuid not null references public.cargos(id) on delete restrict,
    tipo_ajuste text not null check (tipo_ajuste in ('iva_exento','cargo_cancelacion','cargo_modificacion')),
    signo smallint not null check (signo in (-1, 1)),
    porcentaje numeric(5,2) not null check (porcentaje > 0),
    base_calculo bigint not null check (base_calculo > 0),
    monto bigint not null check (monto > 0),
    concepto text not null check (btrim(concepto) <> ''),
    observaciones text,
    estado text not null default 'activo' check (estado in ('activo','anulado')),
    creado_por uuid not null references public.usuarios(id) on delete restrict,
    creado_en timestamptz not null default now(),
    anulado_por uuid references public.usuarios(id) on delete restrict,
    anulado_en timestamptz
);

create index if not exists cargo_ajustes_reserva_idx
    on public.cargo_ajustes (reserva_id, estado);

create index if not exists cargo_ajustes_cargo_idx
    on public.cargo_ajustes (cargo_id, estado);

create index if not exists cargo_ajustes_operacion_idx
    on public.cargo_ajustes (operacion_id);

alter table public.cargo_ajustes enable row level security;

drop policy if exists cargo_ajustes_select on public.cargo_ajustes;
create policy cargo_ajustes_select
on public.cargo_ajustes
for select
to authenticated
using (
    private.haiku_usuario_activo()
    and private.haiku_tiene_permiso('pagos.ver'::text)
);

grant select on public.cargo_ajustes to authenticated;
revoke all on public.cargo_ajustes from anon;

do $$
begin
    if not exists (
        select 1
        from pg_publication_rel pr
        join pg_publication p on p.oid = pr.prpubid
        where p.pubname = 'supabase_realtime'
          and pr.prrelid = 'public.cargo_ajustes'::regclass
    ) then
        alter publication supabase_realtime add table public.cargo_ajustes;
    end if;
end;
$$;

create or replace view public.vista_estado_cargos
with (security_invoker = true)
as
with aplicaciones_netas as (
    select
        pa.cargo_id,
        sum(
            case
                when p.estado = 'confirmado' and p.tipo_movimiento = 'pago'
                    then pa.monto_aplicado
                when p.estado = 'confirmado' and p.tipo_movimiento = 'devolucion'
                    then -pa.monto_aplicado
                else 0::bigint
            end
        )::bigint as aplicado_neto
    from public.pago_aplicaciones pa
    join public.pagos p on p.id = pa.pago_id
    group by pa.cargo_id
),
ajustes_activos as (
    select
        ca.cargo_id,
        sum(
            case
                when ca.estado = 'activo' then ca.signo * ca.monto
                else 0::bigint
            end
        )::bigint as ajuste_neto
    from public.cargo_ajustes ca
    group by ca.cargo_id
),
base as (
    select
        c.*,
        coalesce(aa.ajuste_neto, 0::bigint) as ajuste_neto,
        greatest(
            c.monto + coalesce(aa.ajuste_neto, 0::bigint),
            0::bigint
        )::bigint as monto_ajustado
    from public.cargos c
    left join ajustes_activos aa on aa.cargo_id = c.id
)
select
    b.id as cargo_id,
    b.reserva_id,
    b.estadia_id,
    b.servicio_id,
    b.estadia_noche_id,
    b.tipo_cargo,
    b.concepto,
    b.monto,
    b.estado,
    coalesce(an.aplicado_neto, 0::bigint) as aplicado_neto,
    greatest(
        b.monto_ajustado - coalesce(an.aplicado_neto, 0::bigint),
        0::bigint
    )::bigint as saldo_cargo,
    case
        when b.estado <> 'activo' then 'anulado'::text
        when coalesce(an.aplicado_neto, 0::bigint) <= 0 then 'pendiente'::text
        when coalesce(an.aplicado_neto, 0::bigint) < b.monto_ajustado then 'parcial'::text
        else 'pagado'::text
    end as estado_pago,
    b.ajuste_neto,
    b.monto_ajustado
from base b
left join aplicaciones_netas an on an.cargo_id = b.id;

create or replace view public.vista_saldos_reserva
with (security_invoker = true)
as
with cargos_validos as (
    select
        ec.reserva_id,
        sum(
            case
                when ec.estado = 'activo' then ec.monto_ajustado
                else 0::bigint
            end
        )::bigint as total_cargos
    from public.vista_estado_cargos ec
    group by ec.reserva_id
),
pagos_validos as (
    select
        p.reserva_id,
        sum(
            case
                when p.estado = 'confirmado' and p.tipo_movimiento = 'pago'
                    then p.monto
                when p.estado = 'confirmado' and p.tipo_movimiento = 'devolucion'
                    then -p.monto
                else 0::bigint
            end
        )::bigint as total_pagado_neto
    from public.pagos p
    where p.reserva_id is not null
    group by p.reserva_id
)
select
    r.id as reserva_id,
    coalesce(cv.total_cargos, 0::bigint) as total_cargos,
    coalesce(pv.total_pagado_neto, 0::bigint) as total_pagado_neto,
    coalesce(cv.total_cargos, 0::bigint)
        - coalesce(pv.total_pagado_neto, 0::bigint) as saldo
from public.reservas r
left join cargos_validos cv on cv.reserva_id = r.id
left join pagos_validos pv on pv.reserva_id = r.id;

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
        coalesce(v.total_cargos, 0),
        coalesce(v.total_pagado_neto, 0),
        coalesce(v.saldo, 0)
    into v_total_actual, v_pagado, v_saldo
    from public.vista_saldos_reserva v
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
        coalesce(v.total_cargos, 0),
        coalesce(v.total_pagado_neto, 0)
    into v_total_actual, v_pagado
    from public.vista_saldos_reserva v
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
            raise exception 'No se puede aplicar la exención: los pagos registrados superarían el nuevo total de la reserva';
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
        coalesce(v.total_cargos, 0),
        coalesce(v.total_pagado_neto, 0)
    into v_total_actual, v_pagado
    from public.vista_saldos_reserva v
    where v.reserva_id = v_reserva_id;

    if v_signo = 1 then
        v_nuevo_total := v_total_actual - v_monto;
        if v_pagado > v_nuevo_total then
            raise exception 'No se puede anular: los pagos registrados superarían el total resultante';
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

revoke all on function public.haiku_resumen_ajustes(uuid) from public;
revoke all on function public.haiku_aplicar_ajuste_reserva(uuid, text, text) from public;
revoke all on function public.haiku_anular_ajuste_reserva(uuid) from public;

grant execute on function public.haiku_resumen_ajustes(uuid) to authenticated;
grant execute on function public.haiku_aplicar_ajuste_reserva(uuid, text, text) to authenticated;
grant execute on function public.haiku_anular_ajuste_reserva(uuid) to authenticated;
