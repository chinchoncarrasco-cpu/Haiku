create or replace view public.vista_saldos_alojamiento_reserva
with (security_invoker = true)
as
select
    ec.reserva_id,
    coalesce(sum(ec.monto_ajustado), 0::numeric)::bigint as total_alojamiento,
    coalesce(sum(ec.aplicado_neto), 0::numeric)::bigint as pagado_alojamiento,
    greatest(
        coalesce(sum(ec.monto_ajustado), 0::numeric)::bigint
        - coalesce(sum(ec.aplicado_neto), 0::numeric)::bigint,
        0::bigint
    ) as saldo_alojamiento
from public.vista_estado_cargos ec
where ec.tipo_cargo = 'alojamiento'
  and ec.estado = 'activo'
group by ec.reserva_id;
