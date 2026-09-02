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
        )::bigint as aplicado_original
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
        c.id,
        c.reserva_id,
        c.estadia_id,
        c.servicio_id,
        c.estadia_noche_id,
        c.tipo_cargo,
        c.concepto,
        c.monto,
        c.estado,
        c.creado_en,
        coalesce(an.aplicado_original, 0::bigint) as aplicado_original,
        coalesce(aa.ajuste_neto, 0::bigint) as ajuste_neto,
        greatest(
            c.monto + coalesce(aa.ajuste_neto, 0::bigint),
            0::bigint
        )::bigint as monto_ajustado
    from public.cargos c
    left join aplicaciones_netas an on an.cargo_id = c.id
    left join ajustes_activos aa on aa.cargo_id = c.id
),
contexto as (
    select
        b.*,
        sum(
            case
                when b.tipo_cargo = 'alojamiento' and b.estado = 'activo'
                    then b.aplicado_original
                else 0::bigint
            end
        ) over (partition by b.reserva_id)::bigint as aplicado_alojamiento_total,
        coalesce(
            sum(
                case
                    when b.tipo_cargo = 'alojamiento' and b.estado = 'activo'
                        then b.monto_ajustado
                    else 0::bigint
                end
            ) over (
                partition by b.reserva_id
                order by b.creado_en, b.id
                rows between unbounded preceding and 1 preceding
            ),
            0::bigint
        )::bigint as monto_alojamiento_previo,
        sum(
            case
                when b.tipo_cargo = 'alojamiento' and b.estado = 'activo'
                    then 1
                else 0
            end
        ) over (
            partition by b.reserva_id
            order by b.creado_en, b.id
            rows between unbounded preceding and current row
        ) as orden_alojamiento
    from base b
),
normalizado as (
    select
        x.*,
        case
            when x.tipo_cargo = 'alojamiento' and x.estado = 'activo' then
                case
                    when x.aplicado_alojamiento_total >= 0 then
                        greatest(
                            least(
                                x.aplicado_alojamiento_total - x.monto_alojamiento_previo,
                                x.monto_ajustado
                            ),
                            0::bigint
                        )::bigint
                    when x.orden_alojamiento = 1 then
                        x.aplicado_alojamiento_total
                    else 0::bigint
                end
            else x.aplicado_original
        end::bigint as aplicado_neto
    from contexto x
)
select
    n.id as cargo_id,
    n.reserva_id,
    n.estadia_id,
    n.servicio_id,
    n.estadia_noche_id,
    n.tipo_cargo,
    n.concepto,
    n.monto,
    n.estado,
    n.aplicado_neto,
    greatest(n.monto_ajustado - n.aplicado_neto, 0::bigint)::bigint as saldo_cargo,
    case
        when n.estado <> 'activo' then 'anulado'::text
        when n.aplicado_neto <= 0 then 'pendiente'::text
        when n.aplicado_neto < n.monto_ajustado then 'parcial'::text
        else 'pagado'::text
    end as estado_pago,
    n.ajuste_neto,
    n.monto_ajustado
from normalizado n;
