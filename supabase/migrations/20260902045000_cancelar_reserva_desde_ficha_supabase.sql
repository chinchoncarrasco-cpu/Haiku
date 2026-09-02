create or replace function public.haiku_cancelar_reserva(p_reserva_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
    v_estado_anterior text;
    v_estadias integer := 0;
begin
    if auth.uid() is null then
        raise exception 'Debe iniciar sesión para cancelar reservas';
    end if;

    if not private.haiku_tiene_permiso('reservas.cancelar'::text) then
        raise exception 'No tiene permiso para cancelar reservas';
    end if;

    if p_reserva_id is null then
        raise exception 'Falta la reserva a cancelar';
    end if;

    select r.estado_reserva
      into v_estado_anterior
      from public.reservas r
     where r.id = p_reserva_id
     for update;

    if not found then
        raise exception 'La reserva no existe';
    end if;

    if v_estado_anterior = 'cancelada' then
        return jsonb_build_object(
            'reserva_id', p_reserva_id,
            'estado_anterior', v_estado_anterior,
            'estado', 'cancelada',
            'estadias_canceladas', 0,
            'ya_cancelada', true
        );
    end if;

    update public.reserva_estadias
       set estado_estadia = 'cancelada'
     where reserva_id = p_reserva_id
       and estado_estadia <> 'cancelada';

    get diagnostics v_estadias = row_count;

    update public.reservas
       set estado_reserva = 'cancelada'
     where id = p_reserva_id;

    return jsonb_build_object(
        'reserva_id', p_reserva_id,
        'estado_anterior', v_estado_anterior,
        'estado', 'cancelada',
        'estadias_canceladas', v_estadias,
        'ya_cancelada', false
    );
end;
$function$;

revoke all on function public.haiku_cancelar_reserva(uuid) from public;
revoke all on function public.haiku_cancelar_reserva(uuid) from anon;
grant execute on function public.haiku_cancelar_reserva(uuid) to authenticated;
