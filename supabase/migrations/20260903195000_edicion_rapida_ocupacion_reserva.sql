create or replace function public.haiku_actualizar_ocupacion_reserva(
    p_reserva_id uuid,
    p_adultos smallint,
    p_ninos smallint,
    p_mascotas smallint
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','private'
as $function$
declare
    v_capacidad integer := 0;
    v_actualizados integer := 0;
begin
    if auth.uid() is null then
        raise exception 'Debe iniciar sesión para editar la ocupación';
    end if;

    if not private.haiku_tiene_permiso('reservas.editar'::text) then
        raise exception 'No tiene permiso para editar reservas';
    end if;

    if p_reserva_id is null then
        raise exception 'Reserva inválida';
    end if;

    if p_adultos is null or p_adultos < 1
       or p_ninos is null or p_ninos < 0
       or p_mascotas is null or p_mascotas < 0 then
        raise exception 'Las cantidades de ocupación no son válidas';
    end if;

    select coalesce(min(c.capacidad_total), 0)
      into v_capacidad
      from public.reserva_estadias re
      join public.cabanas c on c.id = re.cabana_id
     where re.reserva_id = p_reserva_id;

    if v_capacidad <= 0 then
        raise exception 'No se encontró la estadía de la reserva';
    end if;

    if (p_adultos + p_ninos) > v_capacidad then
        raise exception 'La ocupación supera la capacidad máxima de la cabaña (%)', v_capacidad;
    end if;

    update public.reserva_estadias
       set adultos = p_adultos,
           ninos = p_ninos,
           mascotas = p_mascotas,
           actualizado_en = now()
     where reserva_id = p_reserva_id;

    get diagnostics v_actualizados = row_count;

    if v_actualizados = 0 then
        raise exception 'No se encontró la estadía de la reserva';
    end if;

    return jsonb_build_object(
        'reserva_id', p_reserva_id,
        'adultos', p_adultos,
        'ninos', p_ninos,
        'mascotas', p_mascotas,
        'capacidad_total', v_capacidad,
        'estadias_actualizadas', v_actualizados
    );
end;
$function$;

revoke all on function public.haiku_actualizar_ocupacion_reserva(uuid,smallint,smallint,smallint) from public;
revoke execute on function public.haiku_actualizar_ocupacion_reserva(uuid,smallint,smallint,smallint) from anon;
grant execute on function public.haiku_actualizar_ocupacion_reserva(uuid,smallint,smallint,smallint) to authenticated;
