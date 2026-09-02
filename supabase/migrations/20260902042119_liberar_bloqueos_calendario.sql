create or replace function public.haiku_liberar_bloqueo_calendario(
    p_bloqueo_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
declare
    v_bloqueo record;
begin
    if auth.uid() is null or not private.haiku_usuario_activo() then
        raise exception 'Debe iniciar sesión con un usuario HAIKU activo';
    end if;

    if not private.haiku_tiene_permiso('cabanas.liberar'::text) then
        raise exception 'No tiene permiso para liberar cabañas';
    end if;

    if p_bloqueo_id is null then
        raise exception 'Falta identificar el bloqueo';
    end if;

    select
        b.id,
        b.cabana_id,
        b.estado,
        b.desde,
        b.hasta,
        c.numero
      into v_bloqueo
      from public.bloqueos_cabana b
      join public.cabanas c on c.id = b.cabana_id
     where b.id = p_bloqueo_id
     for update of b;

    if not found then
        raise exception 'Bloqueo no encontrado';
    end if;

    if v_bloqueo.estado <> 'activo' then
        return jsonb_build_object(
            'bloqueo_id', v_bloqueo.id,
            'cabana_numero', v_bloqueo.numero,
            'desde', (v_bloqueo.desde at time zone 'America/Santiago')::date,
            'hasta', (coalesce(v_bloqueo.hasta, v_bloqueo.desde) at time zone 'America/Santiago')::date,
            'estado', v_bloqueo.estado,
            'ya_liberado', true
        );
    end if;

    update public.bloqueos_cabana
       set estado = 'liberado',
           liberado_por = auth.uid(),
           liberado_en = now(),
           actualizado_en = now()
     where id = v_bloqueo.id;

    return jsonb_build_object(
        'bloqueo_id', v_bloqueo.id,
        'cabana_numero', v_bloqueo.numero,
        'desde', (v_bloqueo.desde at time zone 'America/Santiago')::date,
        'hasta', (coalesce(v_bloqueo.hasta, v_bloqueo.desde) at time zone 'America/Santiago')::date,
        'estado', 'liberado',
        'ya_liberado', false
    );
end;
$function$;

revoke all on function public.haiku_liberar_bloqueo_calendario(uuid) from public;
revoke all on function public.haiku_liberar_bloqueo_calendario(uuid) from anon;
grant execute on function public.haiku_liberar_bloqueo_calendario(uuid) to authenticated;
