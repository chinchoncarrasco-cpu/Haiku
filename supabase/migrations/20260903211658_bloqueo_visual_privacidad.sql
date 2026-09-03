create table if not exists private.bloqueo_visual_config (
    user_id uuid primary key references auth.users(id) on delete cascade,
    pin_hash text not null,
    rescate_hash text not null,
    creado_en timestamptz not null default now(),
    actualizado_en timestamptz not null default now()
);

revoke all on table private.bloqueo_visual_config from public, anon, authenticated;

create or replace function public.haiku_bloqueo_visual_estado()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
    v_uid uuid := auth.uid();
    v_configurado boolean;
begin
    if v_uid is null then
        raise exception 'Sesión no autenticada';
    end if;

    if not exists (
        select 1
        from public.usuarios u
        where u.id = v_uid
          and u.activo = true
    ) then
        raise exception 'Usuario HAIKU no autorizado';
    end if;

    select exists (
        select 1
        from private.bloqueo_visual_config c
        where c.user_id = v_uid
    ) into v_configurado;

    return jsonb_build_object('configurado', v_configurado);
end;
$$;

create or replace function public.haiku_bloqueo_visual_configurar(
    p_pin4 text,
    p_rescate6 text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
    v_uid uuid := auth.uid();
begin
    if v_uid is null then
        raise exception 'Sesión no autenticada';
    end if;

    if not exists (
        select 1
        from public.usuarios u
        where u.id = v_uid
          and u.activo = true
    ) then
        raise exception 'Usuario HAIKU no autorizado';
    end if;

    if p_pin4 is null or p_pin4 !~ '^[0-9]{4}$' then
        raise exception 'El PIN debe tener exactamente 4 números';
    end if;

    if p_rescate6 is null or p_rescate6 !~ '^[0-9]{6}$' then
        raise exception 'La clave de rescate debe tener exactamente 6 números';
    end if;

    if exists (
        select 1
        from private.bloqueo_visual_config c
        where c.user_id = v_uid
    ) then
        raise exception 'La protección visual ya está configurada';
    end if;

    insert into private.bloqueo_visual_config (
        user_id,
        pin_hash,
        rescate_hash
    ) values (
        v_uid,
        extensions.crypt(p_pin4, extensions.gen_salt('bf', 10)),
        extensions.crypt(p_rescate6, extensions.gen_salt('bf', 10))
    );

    return jsonb_build_object('ok', true, 'configurado', true);
end;
$$;

create or replace function public.haiku_bloqueo_visual_verificar(
    p_tipo text,
    p_codigo text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
    v_uid uuid := auth.uid();
    v_hash text;
    v_ok boolean := false;
begin
    if v_uid is null then
        raise exception 'Sesión no autenticada';
    end if;

    if not exists (
        select 1
        from public.usuarios u
        where u.id = v_uid
          and u.activo = true
    ) then
        raise exception 'Usuario HAIKU no autorizado';
    end if;

    if p_tipo = 'pin' then
        if p_codigo is null or p_codigo !~ '^[0-9]{4}$' then
            return jsonb_build_object('ok', false);
        end if;

        select c.pin_hash
        into v_hash
        from private.bloqueo_visual_config c
        where c.user_id = v_uid;
    elsif p_tipo = 'rescate' then
        if p_codigo is null or p_codigo !~ '^[0-9]{6}$' then
            return jsonb_build_object('ok', false);
        end if;

        select c.rescate_hash
        into v_hash
        from private.bloqueo_visual_config c
        where c.user_id = v_uid;
    else
        raise exception 'Tipo de código inválido';
    end if;

    if v_hash is null then
        return jsonb_build_object('ok', false, 'configurado', false);
    end if;

    v_ok := extensions.crypt(p_codigo, v_hash) = v_hash;

    return jsonb_build_object('ok', v_ok, 'configurado', true);
end;
$$;

revoke execute on function public.haiku_bloqueo_visual_estado() from public, anon;
revoke execute on function public.haiku_bloqueo_visual_configurar(text, text) from public, anon;
revoke execute on function public.haiku_bloqueo_visual_verificar(text, text) from public, anon;

grant execute on function public.haiku_bloqueo_visual_estado() to authenticated;
grant execute on function public.haiku_bloqueo_visual_configurar(text, text) to authenticated;
grant execute on function public.haiku_bloqueo_visual_verificar(text, text) to authenticated;
