create or replace function public.haiku_crear_reserva_cambio_cabana(
  p_titular_nombre text,
  p_tramos jsonb,
  p_adultos smallint default 1,
  p_ninos smallint default 0,
  p_mascotas smallint default 0,
  p_correo_contacto text default null,
  p_telefono_contacto text default null,
  p_rut text default null,
  p_observaciones text default null,
  p_acompanantes jsonb default '[]'::jsonb,
  p_cloudbeds_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_cantidad integer;
  v_item jsonb;
  v_idx integer := 0;
  v_cabana smallint;
  v_cabana_id uuid;
  v_precio_base bigint;
  v_ingreso date;
  v_salida date;
  v_salida_anterior date := null;
  v_tarifas jsonb;
  v_primero jsonb;
  v_resultado jsonb;
  v_reserva_id uuid;
  v_estadia_id uuid;
  v_fecha date;
  v_tarifa_text text;
  v_tarifa bigint;
  v_estadias jsonb := '[]'::jsonb;
  v_total bigint := 0;
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

  if jsonb_typeof(coalesce(p_tramos, '[]'::jsonb)) <> 'array' then
    raise exception 'Los tramos deben enviarse como arreglo JSON';
  end if;

  if jsonb_typeof(coalesce(p_acompanantes, '[]'::jsonb)) <> 'array' then
    raise exception 'Los acompañantes deben enviarse como arreglo JSON';
  end if;

  v_cantidad := jsonb_array_length(coalesce(p_tramos, '[]'::jsonb));
  if v_cantidad < 2 or v_cantidad > 11 then
    raise exception 'El cambio de cabaña requiere entre 2 y 11 tramos';
  end if;

  for v_item in select value from jsonb_array_elements(p_tramos)
  loop
    v_idx := v_idx + 1;
    begin
      v_cabana := (v_item ->> 'cabana')::smallint;
      v_ingreso := (v_item ->> 'fecha_ingreso')::date;
      v_salida := (v_item ->> 'fecha_salida')::date;
    exception when others then
      raise exception 'Tramo % inválido: revisa cabaña y fechas', v_idx;
    end;

    if v_cabana is null or v_cabana < 1 or v_cabana > 11 then
      raise exception 'Tramo %: número de cabaña inválido', v_idx;
    end if;
    if v_ingreso is null or v_salida is null or v_salida <= v_ingreso then
      raise exception 'Tramo %: la salida debe ser posterior al ingreso', v_idx;
    end if;
    if v_salida_anterior is not null and v_ingreso <> v_salida_anterior then
      raise exception 'Los tramos deben ser consecutivos y sin huecos. El tramo % debe comenzar el %', v_idx, to_char(v_salida_anterior, 'DD-MM-YYYY');
    end if;
    v_salida_anterior := v_salida;

    v_tarifas := coalesce(v_item -> 'tarifas', '{}'::jsonb);
    if jsonb_typeof(v_tarifas) <> 'object' then
      raise exception 'Tramo %: tarifas inválidas', v_idx;
    end if;

    select id, precio_base into v_cabana_id, v_precio_base
    from public.cabanas where numero = v_cabana and activa = true;
    if not found then
      raise exception 'Tramo %: la CAB % no existe o está inactiva', v_idx, v_cabana;
    end if;

    if not exists (
      select 1 from public.haiku_cabanas_disponibles(v_ingreso, v_salida, 'alojamiento') d
      where d.numero = v_cabana
    ) then
      raise exception 'Tramo %: la CAB % no está disponible entre % y %', v_idx, v_cabana, to_char(v_ingreso, 'DD-MM-YYYY'), to_char(v_salida, 'DD-MM-YYYY');
    end if;
  end loop;

  v_primero := p_tramos -> 0;
  v_resultado := public.haiku_crear_reserva(
    p_titular_nombre => p_titular_nombre,
    p_cabana_numero => (v_primero ->> 'cabana')::smallint,
    p_fecha_ingreso => (v_primero ->> 'fecha_ingreso')::date,
    p_fecha_salida => (v_primero ->> 'fecha_salida')::date,
    p_adultos => greatest(coalesce(p_adultos, 0), 0),
    p_ninos => greatest(coalesce(p_ninos, 0), 0),
    p_mascotas => greatest(coalesce(p_mascotas, 0), 0),
    p_correo_contacto => p_correo_contacto,
    p_telefono_contacto => p_telefono_contacto,
    p_rut => p_rut,
    p_observaciones => p_observaciones,
    p_tarifas => coalesce(v_primero -> 'tarifas', '{}'::jsonb),
    p_acompanantes => p_acompanantes,
    p_tipo_estadia => 'alojamiento',
    p_cloudbeds_id => p_cloudbeds_id
  );

  v_reserva_id := (v_resultado ->> 'reserva_id')::uuid;
  v_estadias := v_estadias || jsonb_build_array(jsonb_build_object(
    'estadia_id', (v_resultado ->> 'estadia_id')::uuid,
    'cabana_numero', (v_resultado ->> 'cabana_numero')::smallint,
    'fecha_ingreso', v_primero ->> 'fecha_ingreso',
    'fecha_salida', v_primero ->> 'fecha_salida'
  ));

  for v_idx in 1..(v_cantidad - 1)
  loop
    v_item := p_tramos -> v_idx;
    v_cabana := (v_item ->> 'cabana')::smallint;
    v_ingreso := (v_item ->> 'fecha_ingreso')::date;
    v_salida := (v_item ->> 'fecha_salida')::date;
    v_tarifas := coalesce(v_item -> 'tarifas', '{}'::jsonb);

    select id, precio_base into v_cabana_id, v_precio_base
    from public.cabanas where numero = v_cabana and activa = true;

    insert into public.reserva_estadias(
      reserva_id, cabana_id, fecha_ingreso, fecha_salida,
      adultos, ninos, mascotas, estado_estadia, tipo_estadia
    ) values (
      v_reserva_id, v_cabana_id, v_ingreso, v_salida,
      greatest(coalesce(p_adultos, 0), 0),
      greatest(coalesce(p_ninos, 0), 0),
      greatest(coalesce(p_mascotas, 0), 0),
      'pendiente', 'alojamiento'
    ) returning id into v_estadia_id;

    insert into public.estadia_huespedes(estadia_id, huesped_id)
    select v_estadia_id, rh.huesped_id
    from public.reserva_huespedes rh
    where rh.reserva_id = v_reserva_id
    on conflict (estadia_id, huesped_id) do nothing;

    v_fecha := v_ingreso;
    while v_fecha < v_salida loop
      v_tarifa_text := v_tarifas ->> to_char(v_fecha, 'YYYY-MM-DD');
      if v_tarifa_text is null or btrim(v_tarifa_text) = '' then
        v_tarifa := v_precio_base;
      else
        begin
          v_tarifa := v_tarifa_text::bigint;
        exception when others then
          raise exception 'Tarifa inválida para la noche % del tramo %', v_fecha, v_idx + 1;
        end;
      end if;

      if coalesce(v_tarifa, 0) <= 0 then
        raise exception 'La tarifa de la noche % del tramo % debe ser mayor que cero', v_fecha, v_idx + 1;
      end if;

      insert into public.estadia_noches(estadia_id, fecha, tarifa, origen_tarifa)
      values(v_estadia_id, v_fecha, v_tarifa, case when v_tarifa_text is null then 'catalogo' else 'manual' end);
      v_fecha := v_fecha + 1;
    end loop;

    v_estadias := v_estadias || jsonb_build_array(jsonb_build_object(
      'estadia_id', v_estadia_id,
      'cabana_numero', v_cabana,
      'fecha_ingreso', v_ingreso,
      'fecha_salida', v_salida
    ));
  end loop;

  select coalesce(sum(monto), 0)::bigint into v_total
  from public.cargos
  where reserva_id = v_reserva_id and tipo_cargo = 'alojamiento' and estado = 'activo';

  return jsonb_build_object(
    'ok', true,
    'reserva_id', v_reserva_id,
    'codigo_haiku', v_resultado ->> 'codigo_haiku',
    'cantidad_tramos', v_cantidad,
    'estadias', v_estadias,
    'total_alojamiento', v_total
  );
end;
$$;

revoke all on function public.haiku_crear_reserva_cambio_cabana(text,jsonb,smallint,smallint,smallint,text,text,text,text,jsonb,text) from public, anon;
grant execute on function public.haiku_crear_reserva_cambio_cabana(text,jsonb,smallint,smallint,smallint,text,text,text,text,jsonb,text) to authenticated;
