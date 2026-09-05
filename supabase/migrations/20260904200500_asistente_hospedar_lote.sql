create or replace function public.haiku_buscar_checkins_fecha_asistente(p_fecha date)
returns table(
  estadia_id uuid,
  reserva_id uuid,
  titular_nombre text,
  cabana_numero smallint,
  fecha_ingreso date,
  fecha_salida date,
  estado_estadia text,
  estado_reserva text,
  checkin_realizado_en timestamptz,
  apta boolean,
  motivo text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception 'Debe iniciar sesión';
  end if;

  return query
  select
    re.id,
    re.reserva_id,
    r.titular_nombre,
    c.numero,
    re.fecha_ingreso,
    re.fecha_salida,
    re.estado_estadia,
    r.estado_reserva,
    re.checkin_realizado_en,
    (
      re.tipo_estadia = 'alojamiento'
      and re.checkin_realizado_en is null
      and re.checkout_realizado_en is null
      and coalesce(re.estado_estadia, '') not in ('cancelada','no_show','hospedada')
      and coalesce(r.estado_reserva, '') not in ('cancelada','no_show')
    ) as apta,
    case
      when re.tipo_estadia <> 'alojamiento' then 'No es alojamiento normal'
      when re.checkin_realizado_en is not null or re.estado_estadia = 'hospedada' then 'Ya está hospedada'
      when re.checkout_realizado_en is not null then 'Ya tiene check-out'
      when re.estado_estadia in ('cancelada','no_show') or r.estado_reserva in ('cancelada','no_show') then 'Reserva no activa'
      else null
    end as motivo
  from public.reserva_estadias re
  join public.reservas r on r.id = re.reserva_id
  join public.cabanas c on c.id = re.cabana_id
  where re.fecha_ingreso = p_fecha
  order by c.numero, r.titular_nombre;
end;
$$;

revoke all on function public.haiku_buscar_checkins_fecha_asistente(date) from public, anon;
grant execute on function public.haiku_buscar_checkins_fecha_asistente(date) to authenticated;

create or replace function public.haiku_hospedar_lote_asistente(
  p_fecha date,
  p_estadias uuid[]
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_total integer;
  v_distintos integer;
  v_resultados jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    raise exception 'Debe iniciar sesión';
  end if;

  if p_fecha is null then
    raise exception 'Fecha requerida';
  end if;

  v_total := coalesce(cardinality(p_estadias), 0);
  if v_total < 1 or v_total > 11 then
    raise exception 'El lote debe contener entre 1 y 11 estadías';
  end if;

  select count(distinct x) into v_distintos
  from unnest(p_estadias) as x;

  if v_distintos <> v_total then
    raise exception 'El lote contiene estadías repetidas';
  end if;

  if (
    select count(*)
    from public.reserva_estadias re
    join public.reservas r on r.id = re.reserva_id
    where re.id = any(p_estadias)
      and re.fecha_ingreso = p_fecha
      and re.tipo_estadia = 'alojamiento'
      and re.checkin_realizado_en is null
      and re.checkout_realizado_en is null
      and coalesce(re.estado_estadia, '') not in ('cancelada','no_show','hospedada')
      and coalesce(r.estado_reserva, '') not in ('cancelada','no_show')
  ) <> v_total then
    raise exception 'Una o más reservas cambiaron desde la vista previa. Recarga y revisa antes de confirmar.';
  end if;

  foreach v_id in array p_estadias loop
    v_resultados := v_resultados || jsonb_build_array(
      public.haiku_registrar_checkin(v_id, now())
    );
  end loop;

  return jsonb_build_object(
    'ok', true,
    'fecha_ingreso', p_fecha,
    'cantidad', v_total,
    'resultados', v_resultados
  );
end;
$$;

revoke all on function public.haiku_hospedar_lote_asistente(date, uuid[]) from public, anon;
grant execute on function public.haiku_hospedar_lote_asistente(date, uuid[]) to authenticated;
