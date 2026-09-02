create or replace view public.vista_saldos_alojamiento_reserva
with (security_invoker = true)
as
select
    reserva_id,
    coalesce(sum(monto_ajustado), 0::numeric)::bigint as total_alojamiento,
    coalesce(sum(aplicado_neto), 0::numeric)::bigint as pagado_alojamiento,
    coalesce(sum(saldo_cargo), 0::numeric)::bigint as saldo_alojamiento
from public.vista_estado_cargos
where tipo_cargo = 'alojamiento'
  and estado = 'activo'
group by reserva_id;
