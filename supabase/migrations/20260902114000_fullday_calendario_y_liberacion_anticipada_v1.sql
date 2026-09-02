alter table public.reserva_estadias
  add column if not exists fullday_liberado_en timestamptz,
  add column if not exists fullday_liberado_por uuid references public.usuarios(id) on delete set null,
  add column if not exists fullday_liberacion_motivo text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reserva_estadias_fullday_liberacion_tipo'
      and conrelid = 'public.reserva_estadias'::regclass
  ) then
    alter table public.reserva_estadias
      add constraint reserva_estadias_fullday_liberacion_tipo
      check (fullday_liberado_en is null or tipo_estadia = 'fullday');
  end if;
end $$;

create or replace function public.haiku_limpiar_liberacion_fullday_si_cambia()
returns trigger
language plpgsql
set search_path = 'pg_catalog', 'public'
as $function$
begin
  if old.fullday_liberado_en is not null and (
       new.tipo_estadia is distinct from old.tipo_estadia
    or new.cabana_id is distinct from old.cabana_id
    or new.fecha_ingreso is distinct from old.fecha_ingreso
    or new.fecha_salida is distinct from old.fecha_salida
  ) then
    new.fullday_liberado_en := null;
    new.fullday_liberado_por := null;
    new.fullday_liberacion_motivo := null;
  end if;
  return new;
end;
$function$;

drop trigger if exists reserva_estadias_limpiar_liberacion_fullday on public.reserva_estadias;
create trigger reserva_estadias_limpiar_liberacion_fullday
before update of tipo_estadia, cabana_id, fecha_ingreso, fecha_salida
on public.reserva_estadias
for each row execute function public.haiku_limpiar_liberacion_fullday_si_cambia();

create or replace function public.haiku_liberar_fullday(
  p_reserva_id uuid,
  p_motivo text default 'Salida anticipada y cabaña aseada'
)
returns jsonb
language plpgsql
security definer
set search_path = 'pg_catalog', 'public', 'private'
as $function$
declare
  v_estadia public.reserva_estadias%rowtype;
  v_fecha_hoy date := (now() at time zone 'America/Santiago')::date;
begin
  if auth.uid() is null then
    raise exception 'Debe iniciar sesión para liberar un Full Day';
  end if;

  if not private.haiku_tiene_permiso('reservas.editar'::text) then
    raise exception 'No tiene permiso para liberar Full Day';
  end if;

  select e.* into v_estadia
  from public.reserva_estadias e
  where e.reserva_id = p_reserva_id
    and e.tipo_estadia = 'fullday'
    and e.estado_estadia not in ('cancelada','no_show')
  order by e.creado_en desc
  limit 1
  for update;

  if not found then
    raise exception 'No existe un Full Day activo para esta reserva';
  end if;

  if v_estadia.fullday_liberado_en is not null then
    return jsonb_build_object(
      'reserva_id', p_reserva_id,
      'estadia_id', v_estadia.id,
      'fecha', v_estadia.fecha_ingreso,
      'ya_liberado', true,
      'liberado_en', v_estadia.fullday_liberado_en
    );
  end if;

  if v_estadia.fecha_ingreso > v_fecha_hoy then
    raise exception 'No se puede liberar un Full Day antes de su fecha';
  end if;

  update public.reserva_estadias
  set fullday_liberado_en = now(),
      fullday_liberado_por = auth.uid(),
      fullday_liberacion_motivo = nullif(btrim(coalesce(p_motivo,'')), '')
  where id = v_estadia.id;

  return jsonb_build_object(
    'reserva_id', p_reserva_id,
    'estadia_id', v_estadia.id,
    'fecha', v_estadia.fecha_ingreso,
    'ya_liberado', false,
    'liberado_en', now()
  );
end;
$function$;

revoke all on function public.haiku_liberar_fullday(uuid,text) from public;
grant execute on function public.haiku_liberar_fullday(uuid,text) to authenticated;

create or replace function public.haiku_cabanas_disponibles(p_fecha_ingreso date, p_fecha_salida date, p_tipo_estadia text default 'alojamiento'::text)
returns table(cabana_id uuid, numero smallint, nombre text, capacidad_total smallint, precio_base bigint)
language plpgsql
stable
set search_path to 'pg_catalog', 'public', 'private'
as $function$
begin
  if not private.haiku_usuario_activo() then
    raise exception 'Usuario HAIKU inactivo o no registrado' using errcode = '42501';
  end if;

  if not (
    private.haiku_tiene_permiso('cabanas.ver')
    and private.haiku_tiene_permiso('reservas.ver')
  ) then
    raise exception 'Sin permiso para consultar disponibilidad' using errcode = '42501';
  end if;

  if p_tipo_estadia not in ('alojamiento','fullday') then
    raise exception 'Tipo de estadía no válido';
  end if;

  if p_tipo_estadia = 'alojamiento' and p_fecha_salida <= p_fecha_ingreso then
    raise exception 'La fecha de salida debe ser posterior al ingreso';
  end if;

  if p_tipo_estadia = 'fullday' and p_fecha_salida <> p_fecha_ingreso then
    raise exception 'FULLDAY debe ingresar y salir el mismo día';
  end if;

  return query
  select c.id, c.numero, c.nombre, c.capacidad_total, c.precio_base
  from public.cabanas c
  where c.activa = true
    and not exists (
      select 1
      from public.bloqueos_cabana b
      where b.cabana_id = c.id
        and b.estado = 'activo'
        and tstzrange(b.desde, coalesce(b.hasta, 'infinity'::timestamptz), '[)') &&
            case
              when p_tipo_estadia = 'fullday' then
                tstzrange(
                  (p_fecha_ingreso::timestamp at time zone 'America/Santiago'),
                  ((p_fecha_ingreso + 1)::timestamp at time zone 'America/Santiago'),
                  '[)'
                )
              else
                tstzrange(
                  (p_fecha_ingreso::timestamp at time zone 'America/Santiago'),
                  (p_fecha_salida::timestamp at time zone 'America/Santiago'),
                  '[)'
                )
            end
    )
    and not exists (
      select 1
      from public.reserva_estadias e
      where e.cabana_id = c.id
        and e.estado_estadia not in ('cancelada','no_show')
        and not (e.tipo_estadia = 'fullday' and e.fullday_liberado_en is not null)
        and (
          (
            p_tipo_estadia = 'alojamiento'
            and e.tipo_estadia = 'alojamiento'
            and daterange(e.fecha_ingreso, e.fecha_salida, '[)')
                && daterange(p_fecha_ingreso, p_fecha_salida, '[)')
          )
          or (
            p_tipo_estadia = 'alojamiento'
            and e.tipo_estadia = 'fullday'
            and e.fecha_ingreso >= p_fecha_ingreso
            and e.fecha_ingreso < p_fecha_salida
          )
          or (
            p_tipo_estadia = 'fullday'
            and e.tipo_estadia = 'alojamiento'
            and p_fecha_ingreso >= e.fecha_ingreso
            and p_fecha_ingreso < e.fecha_salida
          )
          or (
            p_tipo_estadia = 'fullday'
            and e.tipo_estadia = 'fullday'
            and e.fecha_ingreso = p_fecha_ingreso
          )
        )
    )
  order by c.orden_visual nulls last, c.numero;
end;
$function$;

create or replace function public.haiku_validar_conflicto_fullday_alojamiento()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  if new.estado_estadia in ('cancelada','no_show') then
    return new;
  end if;

  if new.tipo_estadia = 'fullday' and new.fullday_liberado_en is not null then
    return new;
  end if;

  if new.tipo_estadia = 'fullday' then
    if exists (
      select 1
      from public.reserva_estadias e
      where e.cabana_id = new.cabana_id
        and e.id <> new.id
        and e.tipo_estadia = 'alojamiento'
        and e.estado_estadia not in ('cancelada','no_show')
        and new.fecha_ingreso between e.fecha_ingreso and e.fecha_salida
    ) then
      raise exception 'El FullDay entra en conflicto con una estadía de alojamiento en esa cabaña';
    end if;
  else
    if exists (
      select 1
      from public.reserva_estadias e
      where e.cabana_id = new.cabana_id
        and e.id <> new.id
        and e.tipo_estadia = 'fullday'
        and e.fullday_liberado_en is null
        and e.estado_estadia not in ('cancelada','no_show')
        and e.fecha_ingreso between new.fecha_ingreso and new.fecha_salida
    ) then
      raise exception 'La estadía entra en conflicto con un FullDay existente en esa cabaña';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function private.haiku_operacion_dia_impl(p_fecha date)
returns table(fecha date, cabana_id uuid, numero smallint, nombre text, estado_operativo text, ingreso_estadia_id uuid, ingreso_reserva_id uuid, ingreso_titular text, hora_ingreso_prevista time without time zone, ingreso_checkin_en timestamp with time zone, salida_estadia_id uuid, salida_reserva_id uuid, salida_titular text, salida_checkout_en timestamp with time zone, continua_estadia_id uuid, continua_reserva_id uuid, continua_titular text, fullday_estadia_id uuid, fullday_reserva_id uuid, fullday_titular text, bloqueo_id uuid, bloqueo_motivo text, aseo_id uuid, aseo_estado text, aseo_asignado_a uuid, aseo_asignado_nombre text, revision_id uuid, revision_estado text, revision_resultado text)
language plpgsql
stable security definer
set search_path to 'pg_catalog', 'public', 'private'
as $function$
begin
  if not private.haiku_usuario_activo() then
    raise exception 'Usuario HAIKU inactivo o no registrado' using errcode = '42501';
  end if;

  if not (
    private.haiku_tiene_permiso('cabanas.ver')
    or private.haiku_tiene_permiso('aseos.ver_asignados')
    or private.haiku_tiene_permiso('aseos.ver_todos')
  ) then
    raise exception 'Sin permiso para consultar la operación diaria' using errcode = '42501';
  end if;

  return query
  with limites as (
    select
      (p_fecha::timestamp at time zone 'America/Santiago') as inicio_dia,
      ((p_fecha + 1)::timestamp at time zone 'America/Santiago') as fin_dia
  )
  select
    p_fecha,
    c.id,
    c.numero,
    c.nombre,
    case
      when bl.id is not null then 'bloqueada'
      when fd.id is not null then 'fullday'
      when sal.id is not null and ing.id is not null then 'sale-ingresa'
      when ing.id is not null then 'libre-ingresa'
      when sal.id is not null then 'sale-libre'
      when cont.id is not null then 'continua'
      else 'libre-libre'
    end,
    ing.id, ing.reserva_id, ring.titular_nombre, ing.hora_ingreso_prevista, ing.checkin_realizado_en,
    sal.id, sal.reserva_id, rsal.titular_nombre, sal.checkout_realizado_en,
    cont.id, cont.reserva_id, rcont.titular_nombre,
    fd.id, fd.reserva_id, rfd.titular_nombre,
    bl.id, bl.motivo,
    a.id, a.estado, a.asignado_a,
    nullif(btrim(concat_ws(' ', ua.nombre, ua.apellido)), ''),
    rev.id, rev.estado, rev.resultado
  from public.cabanas c
  cross join limites l
  left join lateral (
    select b.* from public.bloqueos_cabana b
    where b.cabana_id = c.id
      and b.estado = 'activo'
      and tstzrange(b.desde, coalesce(b.hasta, 'infinity'::timestamptz), '[)')
          && tstzrange(l.inicio_dia, l.fin_dia, '[)')
    order by b.desde desc, b.creado_en desc limit 1
  ) bl on true
  left join lateral (
    select e.* from public.reserva_estadias e
    where e.cabana_id = c.id and e.tipo_estadia = 'alojamiento'
      and e.fecha_ingreso = p_fecha and e.estado_estadia not in ('cancelada','no_show')
    order by e.creado_en desc limit 1
  ) ing on true
  left join public.reservas ring on ring.id = ing.reserva_id
  left join lateral (
    select e.* from public.reserva_estadias e
    where e.cabana_id = c.id and e.tipo_estadia = 'alojamiento'
      and e.fecha_salida = p_fecha and e.estado_estadia not in ('cancelada','no_show')
    order by e.creado_en desc limit 1
  ) sal on true
  left join public.reservas rsal on rsal.id = sal.reserva_id
  left join lateral (
    select e.* from public.reserva_estadias e
    where e.cabana_id = c.id and e.tipo_estadia = 'alojamiento'
      and p_fecha > e.fecha_ingreso and p_fecha < e.fecha_salida
      and e.estado_estadia not in ('cancelada','no_show')
    order by e.fecha_ingreso desc, e.creado_en desc limit 1
  ) cont on true
  left join public.reservas rcont on rcont.id = cont.reserva_id
  left join lateral (
    select e.* from public.reserva_estadias e
    where e.cabana_id = c.id and e.tipo_estadia = 'fullday'
      and e.fecha_ingreso = p_fecha
      and e.fullday_liberado_en is null
      and e.estado_estadia not in ('cancelada','no_show')
    order by e.creado_en desc limit 1
  ) fd on true
  left join public.reservas rfd on rfd.id = fd.reserva_id
  left join lateral (
    select ax.* from public.aseos ax
    where ax.cabana_id = c.id and ax.fecha = p_fecha
    order by ax.creado_en desc limit 1
  ) a on true
  left join public.usuarios ua on ua.id = a.asignado_a
  left join lateral (
    select rx.* from public.revisiones_cabana rx
    where rx.cabana_id = c.id and rx.fecha = p_fecha
    order by rx.creado_en desc limit 1
  ) rev on true
  where c.activa = true
  order by c.orden_visual nulls last, c.numero;
end;
$function$;
