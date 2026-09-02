create or replace function public.haiku_crear_reserva(
  p_titular_nombre text,
  p_cabana_numero smallint,
  p_fecha_ingreso date,
  p_fecha_salida date,
  p_adultos smallint default 1,
  p_ninos smallint default 0,
  p_mascotas smallint default 0,
  p_correo_contacto text default null,
  p_telefono_contacto text default null,
  p_rut text default null,
  p_observaciones text default null,
  p_tarifas jsonb default '{}'::jsonb,
  p_acompanantes jsonb default '[]'::jsonb,
  p_tipo_estadia text default 'alojamiento',
  p_cloudbeds_id text default null
)
returns jsonb
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
  v_cabana_id uuid;
  v_cabana_activa boolean;
  v_precio_base bigint;
  v_reserva_id uuid;
  v_estadia_id uuid;
  v_titular_huesped_id uuid;
  v_huesped_id uuid;
  v_codigo text;
  v_fecha date;
  v_tarifa bigint;
  v_tarifa_text text;
  v_acompanante text;
  v_rut_normalizado text;
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

  if p_tipo_estadia not in ('alojamiento','fullday') then
    raise exception 'Tipo de estadía inválido';
  end if;

  if p_tipo_estadia = 'alojamiento' and p_fecha_salida <= p_fecha_ingreso then
    raise exception 'La fecha de salida debe ser posterior al ingreso';
  end if;

  if p_tipo_estadia = 'fullday' and p_fecha_salida <> p_fecha_ingreso then
    raise exception 'FULLDAY debe ingresar y salir el mismo día';
  end if;

  if jsonb_typeof(coalesce(p_tarifas, '{}'::jsonb)) <> 'object' then
    raise exception 'Las tarifas deben enviarse como objeto JSON fecha → monto';
  end if;

  if jsonb_typeof(coalesce(p_acompanantes, '[]'::jsonb)) <> 'array' then
    raise exception 'Los acompañantes deben enviarse como arreglo JSON';
  end if;

  select id, activa, precio_base
    into v_cabana_id, v_cabana_activa, v_precio_base
  from public.cabanas
  where numero = p_cabana_numero;

  if not found then
    raise exception 'La CAB % no existe', p_cabana_numero;
  end if;
  if not v_cabana_activa then
    raise exception 'La CAB % está inactiva', p_cabana_numero;
  end if;

  if not exists (
    select 1
    from public.haiku_cabanas_disponibles(p_fecha_ingreso, p_fecha_salida, p_tipo_estadia) d
    where d.numero = p_cabana_numero
  ) then
    raise exception 'La CAB % no está disponible para esa fecha o rango', p_cabana_numero;
  end if;

  if p_rut is not null and btrim(p_rut) <> '' then
    v_rut_normalizado := regexp_replace(upper(btrim(p_rut)), '[^0-9K]', '', 'g');
    select id into v_titular_huesped_id
    from public.huespedes
    where tipo_documento = 'rut'
      and numero_documento = v_rut_normalizado
    limit 1;
  end if;

  if v_titular_huesped_id is null then
    insert into public.huespedes(nombre,tipo_documento,numero_documento,telefono,correo)
    values (
      btrim(p_titular_nombre),
      case when v_rut_normalizado is not null then 'rut' else null end,
      v_rut_normalizado,
      nullif(btrim(coalesce(p_telefono_contacto,'')), ''),
      nullif(btrim(coalesce(p_correo_contacto,'')), '')
    ) returning id into v_titular_huesped_id;
  end if;

  v_codigo := 'H-' || to_char(p_fecha_ingreso,'YYYYMMDD') || '-' ||
              lpad(p_cabana_numero::text,2,'0') || '-' ||
              upper(substr(replace(gen_random_uuid()::text,'-',''),1,6));

  insert into public.reservas(
    cloudbeds_id,codigo_haiku,titular_nombre,
    titular_tipo_documento,titular_numero_documento,
    correo_contacto,telefono_contacto,titular_huesped_id,
    estado_reserva,observaciones
  ) values (
    nullif(btrim(coalesce(p_cloudbeds_id,'')), ''),
    v_codigo,btrim(p_titular_nombre),
    case when v_rut_normalizado is not null then 'rut' else null end,
    v_rut_normalizado,
    nullif(btrim(coalesce(p_correo_contacto,'')), ''),
    nullif(btrim(coalesce(p_telefono_contacto,'')), ''),
    v_titular_huesped_id,'pendiente',
    nullif(btrim(coalesce(p_observaciones,'')), '')
  ) returning id into v_reserva_id;

  insert into public.reserva_estadias(
    reserva_id,cabana_id,fecha_ingreso,fecha_salida,
    adultos,ninos,mascotas,estado_estadia,tipo_estadia
  ) values (
    v_reserva_id,v_cabana_id,p_fecha_ingreso,p_fecha_salida,
    greatest(coalesce(p_adultos,0),0),
    greatest(coalesce(p_ninos,0),0),
    greatest(coalesce(p_mascotas,0),0),
    'pendiente',p_tipo_estadia
  ) returning id into v_estadia_id;

  insert into public.reserva_huespedes(reserva_id,huesped_id)
  values (v_reserva_id,v_titular_huesped_id);
  insert into public.estadia_huespedes(estadia_id,huesped_id)
  values (v_estadia_id,v_titular_huesped_id);

  for v_acompanante in
    select btrim(value)
    from jsonb_array_elements_text(coalesce(p_acompanantes,'[]'::jsonb))
  loop
    if v_acompanante <> '' then
      insert into public.huespedes(nombre)
      values (v_acompanante)
      returning id into v_huesped_id;
      insert into public.reserva_huespedes(reserva_id,huesped_id)
      values (v_reserva_id,v_huesped_id);
      insert into public.estadia_huespedes(estadia_id,huesped_id)
      values (v_estadia_id,v_huesped_id);
    end if;
  end loop;

  if p_tipo_estadia = 'alojamiento' then
    v_fecha := p_fecha_ingreso;
    while v_fecha < p_fecha_salida loop
      v_tarifa_text := p_tarifas ->> to_char(v_fecha,'YYYY-MM-DD');
      if v_tarifa_text is null or btrim(v_tarifa_text) = '' then
        if v_precio_base is null then
          raise exception 'Falta tarifa para la noche % y la CAB no tiene precio base', v_fecha;
        end if;
        v_tarifa := v_precio_base;
      else
        begin
          v_tarifa := v_tarifa_text::bigint;
        exception when others then
          raise exception 'Tarifa inválida para la noche %', v_fecha;
        end;
      end if;
      if v_tarifa <= 0 then
        raise exception 'La tarifa de la noche % debe ser mayor que cero', v_fecha;
      end if;
      insert into public.estadia_noches(estadia_id,fecha,tarifa,origen_tarifa)
      values (
        v_estadia_id,v_fecha,v_tarifa,
        case when v_tarifa_text is null then 'catalogo' else 'manual' end
      );
      v_fecha := v_fecha + 1;
    end loop;
  else
    v_tarifa_text := p_tarifas ->> to_char(p_fecha_ingreso,'YYYY-MM-DD');
    if v_tarifa_text is null or btrim(v_tarifa_text) = '' then
      if v_precio_base is null then
        raise exception 'Falta tarifa para el Full Day y la CAB no tiene precio base';
      end if;
      v_tarifa := v_precio_base;
    else
      begin
        v_tarifa := v_tarifa_text::bigint;
      exception when others then
        raise exception 'Tarifa inválida para el Full Day';
      end;
    end if;
    if v_tarifa <= 0 then
      raise exception 'La tarifa del Full Day debe ser mayor que cero';
    end if;

    insert into public.cargos(
      reserva_id,estadia_id,estadia_noche_id,tipo_cargo,concepto,monto,moneda,estado,creado_por
    ) values (
      v_reserva_id,v_estadia_id,null,'alojamiento',
      'Full Day · ' || to_char(p_fecha_ingreso,'DD-MM-YYYY'),
      v_tarifa,'CLP','activo',auth.uid()
    );
  end if;

  return jsonb_build_object(
    'reserva_id',v_reserva_id,
    'estadia_id',v_estadia_id,
    'codigo_haiku',v_codigo,
    'cabana_numero',p_cabana_numero,
    'fecha_ingreso',p_fecha_ingreso,
    'fecha_salida',p_fecha_salida,
    'tipo_estadia',p_tipo_estadia,
    'estado_reserva','pendiente'
  );
end;
$function$;