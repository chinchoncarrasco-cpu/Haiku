create or replace function public.haiku_revertir_checkin(p_estadia_id uuid)
returns jsonb
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_reserva_id uuid;
  v_checkout timestamptz;
  v_estado text;
begin
  if auth.uid() is null then
    raise exception 'Debe iniciar sesión';
  end if;

  select reserva_id, checkout_realizado_en, estado_estadia
    into v_reserva_id, v_checkout, v_estado
  from public.reserva_estadias
  where id = p_estadia_id;

  if not found then
    raise exception 'La estadía no existe o no tiene permiso para editarla';
  end if;

  if v_checkout is not null or coalesce(v_estado, '') = 'checked_out' then
    raise exception 'No se puede volver directamente a Confirmada porque esta estadía ya tiene Checked Out';
  end if;

  update public.reserva_estadias
  set checkin_realizado_en = null,
      checkin_realizado_por = null,
      estado_estadia = 'confirmada'
  where id = p_estadia_id;

  if exists (
    select 1
    from public.reserva_estadias
    where reserva_id = v_reserva_id
      and estado_estadia = 'hospedada'
      and checkin_realizado_en is not null
      and checkout_realizado_en is null
  ) then
    update public.reservas
    set estado_reserva = 'hospedada'
    where id = v_reserva_id;
  elsif not exists (
    select 1
    from public.reserva_estadias
    where reserva_id = v_reserva_id
      and estado_estadia not in ('checked_out', 'cancelada', 'no_show')
  ) then
    update public.reservas
    set estado_reserva = 'checked_out'
    where id = v_reserva_id;
  else
    update public.reservas
    set estado_reserva = 'confirmada'
    where id = v_reserva_id;
  end if;

  return jsonb_build_object(
    'estadia_id', p_estadia_id,
    'reserva_id', v_reserva_id,
    'estado', 'confirmada'
  );
end;
$function$;
