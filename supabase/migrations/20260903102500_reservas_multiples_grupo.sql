-- =====================================================
-- HAIKU · RESERVAS MÚLTIPLES · V1
-- Una operación puede crear 2+ reservas independientes,
-- vinculadas por grupo_reserva_id y dentro de una sola transacción.
-- =====================================================

alter table public.reservas
    add column if not exists grupo_reserva_id uuid;

create index if not exists reservas_grupo_reserva_id_idx
    on public.reservas (grupo_reserva_id)
    where grupo_reserva_id is not null;

create or replace function public.haiku_crear_reservas_multiples(
    p_titular_nombre text,
    p_fecha_ingreso date,
    p_fecha_salida date,
    p_alojamientos jsonb,
    p_correo_contacto text default null,
    p_telefono_contacto text default null,
    p_rut text default null,
    p_observaciones text default null,
    p_cloudbeds_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
    v_grupo_id uuid := gen_random_uuid();
    v_item jsonb;
    v_resultado jsonb;
    v_resultados jsonb := '[]'::jsonb;
    v_cabana smallint;
    v_adultos smallint;
    v_ninos smallint;
    v_mascotas smallint;
    v_tarifas jsonb;
    v_acompanantes jsonb;
    v_cabanas_vistas smallint[] := array[]::smallint[];
begin
    if auth.uid() is null then
        raise exception 'Debe iniciar sesión para crear reservas';
    end if;

    if not private.haiku_tiene_permiso('reservas.crear') then
        raise exception 'Sin permiso para crear reservas' using errcode = '42501';
    end if;

    if p_titular_nombre is null or btrim(p_titular_nombre) = '' then
        raise exception 'El titular es obligatorio';
    end if;

    if p_fecha_salida <= p_fecha_ingreso then
        raise exception 'La fecha de salida debe ser posterior al ingreso';
    end if;

    if jsonb_typeof(coalesce(p_alojamientos, '[]'::jsonb)) <> 'array' then
        raise exception 'Los alojamientos deben enviarse como arreglo JSON';
    end if;

    if jsonb_array_length(coalesce(p_alojamientos, '[]'::jsonb)) < 2 then
        raise exception 'La reserva múltiple requiere al menos dos alojamientos';
    end if;

    for v_item in
        select value
        from jsonb_array_elements(p_alojamientos)
    loop
        begin
            v_cabana := (v_item ->> 'cabana')::smallint;
        exception when others then
            raise exception 'Número de cabaña inválido en reserva múltiple';
        end;

        if v_cabana is null or v_cabana <= 0 then
            raise exception 'Número de cabaña inválido en reserva múltiple';
        end if;

        if v_cabana = any(v_cabanas_vistas) then
            raise exception 'La CAB % está repetida en la reserva múltiple', v_cabana;
        end if;
        v_cabanas_vistas := array_append(v_cabanas_vistas, v_cabana);

        begin
            v_adultos := greatest(coalesce((v_item ->> 'adultos')::smallint, 1), 0);
            v_ninos := greatest(coalesce((v_item ->> 'ninos')::smallint, 0), 0);
            v_mascotas := greatest(coalesce((v_item ->> 'mascotas')::smallint, 0), 0);
        exception when others then
            raise exception 'Ocupación inválida para CAB %', v_cabana;
        end;

        v_tarifas := coalesce(v_item -> 'tarifas', '{}'::jsonb);
        v_acompanantes := coalesce(v_item -> 'acompanantes', '[]'::jsonb);

        if jsonb_typeof(v_tarifas) <> 'object' then
            raise exception 'Tarifas inválidas para CAB %', v_cabana;
        end if;

        if jsonb_typeof(v_acompanantes) <> 'array' then
            raise exception 'Acompañantes inválidos para CAB %', v_cabana;
        end if;

        v_resultado := public.haiku_crear_reserva(
            p_titular_nombre => p_titular_nombre,
            p_cabana_numero => v_cabana,
            p_fecha_ingreso => p_fecha_ingreso,
            p_fecha_salida => p_fecha_salida,
            p_adultos => v_adultos,
            p_ninos => v_ninos,
            p_mascotas => v_mascotas,
            p_correo_contacto => p_correo_contacto,
            p_telefono_contacto => p_telefono_contacto,
            p_rut => p_rut,
            p_observaciones => p_observaciones,
            p_tarifas => v_tarifas,
            p_acompanantes => v_acompanantes,
            p_tipo_estadia => 'alojamiento',
            p_cloudbeds_id => null
        );

        update public.reservas
        set grupo_reserva_id = v_grupo_id
        where id = (v_resultado ->> 'reserva_id')::uuid;

        v_resultados := v_resultados || jsonb_build_array(
            v_resultado || jsonb_build_object(
                'grupo_reserva_id', v_grupo_id
            )
        );
    end loop;

    return jsonb_build_object(
        'grupo_reserva_id', v_grupo_id,
        'reservas', v_resultados
    );
end;
$function$;

revoke all on function public.haiku_crear_reservas_multiples(
    text,date,date,jsonb,text,text,text,text,text
) from public;

grant execute on function public.haiku_crear_reservas_multiples(
    text,date,date,jsonb,text,text,text,text,text
) to authenticated;
