create or replace function public.haiku_registrar_bloqueo_calendario(
    p_cabana_numero smallint,
    p_desde date,
    p_hasta date,
    p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $$
declare
    v_cabana_id uuid;
    v_desde timestamptz;
    v_hasta timestamptz;
    v_motivo text;
    v_existente uuid;
    v_bloqueo_id uuid;
begin
    if auth.uid() is null then
        raise exception 'Debe iniciar sesión para bloquear cabañas';
    end if;

    if not private.haiku_tiene_permiso('cabanas.bloquear'::text) then
        raise exception 'No tiene permiso para bloquear cabañas';
    end if;

    if p_cabana_numero is null or p_desde is null or p_hasta is null then
        raise exception 'Faltan datos para crear el bloqueo';
    end if;

    if p_hasta <= p_desde then
        raise exception 'El término del bloqueo debe ser posterior al inicio';
    end if;

    select c.id
      into v_cabana_id
      from public.cabanas c
     where c.numero = p_cabana_numero
       and c.activa = true;

    if v_cabana_id is null then
        raise exception 'Cabaña % no encontrada o inactiva', p_cabana_numero;
    end if;

    v_desde := p_desde::timestamp at time zone 'America/Santiago';
    v_hasta := p_hasta::timestamp at time zone 'America/Santiago';
    v_motivo := nullif(btrim(coalesce(p_motivo, '')), '');
    if v_motivo is null then
        v_motivo := 'Bloqueo calendario HAIKU';
    end if;

    perform pg_advisory_xact_lock(hashtextextended(v_cabana_id::text, 0));

    select b.id
      into v_existente
      from public.bloqueos_cabana b
     where b.cabana_id = v_cabana_id
       and b.estado = 'activo'
       and b.desde <= v_desde
       and coalesce(b.hasta, 'infinity'::timestamptz) >= v_hasta
     order by b.desde desc
     limit 1;

    if v_existente is not null then
        return jsonb_build_object(
            'bloqueo_id', v_existente,
            'cabana_numero', p_cabana_numero,
            'desde', p_desde,
            'hasta', p_hasta,
            'ya_existia', true
        );
    end if;

    if exists (
        select 1
          from public.bloqueos_cabana b
         where b.cabana_id = v_cabana_id
           and b.estado = 'activo'
           and tstzrange(b.desde, coalesce(b.hasta, 'infinity'::timestamptz), '[)')
               && tstzrange(v_desde, v_hasta, '[)')
    ) then
        raise exception 'La cabaña ya tiene otro bloqueo activo que se cruza con ese rango';
    end if;

    if exists (
        select 1
          from public.reserva_estadias e
         where e.cabana_id = v_cabana_id
           and e.estado_estadia not in ('cancelada','no_show')
           and (
                (e.tipo_estadia = 'alojamiento'
                 and e.fecha_ingreso < p_hasta
                 and e.fecha_salida > p_desde)
             or (e.tipo_estadia = 'fullday'
                 and e.fecha_ingreso >= p_desde
                 and e.fecha_ingreso < p_hasta)
           )
    ) then
        raise exception 'La cabaña tiene una estadía que se cruza con el bloqueo';
    end if;

    insert into public.bloqueos_cabana (
        cabana_id,
        tipo_bloqueo,
        motivo,
        desde,
        hasta,
        estado,
        bloqueado_por,
        bloqueado_en,
        observaciones
    ) values (
        v_cabana_id,
        'manual',
        v_motivo,
        v_desde,
        v_hasta,
        'activo',
        auth.uid(),
        now(),
        'Sincronizado desde Calendario HAIKU'
    )
    returning id into v_bloqueo_id;

    return jsonb_build_object(
        'bloqueo_id', v_bloqueo_id,
        'cabana_numero', p_cabana_numero,
        'desde', p_desde,
        'hasta', p_hasta,
        'ya_existia', false
    );
end;
$$;

revoke all on function public.haiku_registrar_bloqueo_calendario(smallint,date,date,text) from public;
grant execute on function public.haiku_registrar_bloqueo_calendario(smallint,date,date,text) to authenticated;
