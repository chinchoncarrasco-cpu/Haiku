create or replace function public.haiku_info_reactivacion_reserva(p_reserva_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
    v_resultado jsonb;
begin
    if auth.uid() is null then
        raise exception 'Debe iniciar sesión' using errcode = '42501';
    end if;
    if not private.haiku_tiene_permiso('reservas.ver') then
        raise exception 'Sin permiso para ver reservas' using errcode = '42501';
    end if;

    select jsonb_build_object(
        'reserva_id', r.id,
        'codigo_haiku', r.codigo_haiku,
        'cloudbeds_id', r.cloudbeds_id,
        'titular', r.titular_nombre,
        'estado_reserva', r.estado_reserva,
        'estadia_id', e.id,
        'estado_estadia', e.estado_estadia,
        'cabana_numero', c.numero,
        'fecha_ingreso', e.fecha_ingreso,
        'fecha_salida', e.fecha_salida,
        'tipo_estadia', e.tipo_estadia,
        'checkin_realizado_en', e.checkin_realizado_en,
        'checkout_realizado_en', e.checkout_realizado_en,
        'abono_confirmado', coalesce((
            select sum(p.monto)
            from public.pagos p
            where p.reserva_id = r.id
              and p.estado = 'confirmado'
              and p.tipo_movimiento = 'pago'
              and p.etapa_operativa = 'abono'
        ),0)
    )
      into v_resultado
      from public.reservas r
      left join lateral (
          select ex.*
          from public.reserva_estadias ex
          where ex.reserva_id = r.id
          order by
              case when ex.estado_estadia = 'cancelada' then 0 else 1 end,
              ex.actualizado_en desc,
              ex.creado_en desc
          limit 1
      ) e on true
      left join public.cabanas c on c.id = e.cabana_id
     where r.id = p_reserva_id;

    if v_resultado is null then
        raise exception 'La reserva no existe';
    end if;

    return v_resultado;
end;
$function$;

create or replace function public.haiku_buscar_reservas_canceladas(p_busqueda text)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
    v_busqueda text := lower(btrim(coalesce(p_busqueda,'')));
    v_resultado jsonb;
begin
    if auth.uid() is null then
        raise exception 'Debe iniciar sesión' using errcode = '42501';
    end if;
    if not private.haiku_tiene_permiso('reservas.ver') then
        raise exception 'Sin permiso para ver reservas' using errcode = '42501';
    end if;

    if length(v_busqueda) < 2 then
        return '[]'::jsonb;
    end if;

    with resultados as (
        select
            r.id as reserva_id,
            r.codigo_haiku,
            r.cloudbeds_id,
            r.titular_nombre as titular,
            r.titular_numero_documento as documento,
            c.numero as cabana_numero,
            e.fecha_ingreso,
            e.fecha_salida,
            e.tipo_estadia,
            coalesce((
                select sum(p.monto)
                from public.pagos p
                where p.reserva_id = r.id
                  and p.estado = 'confirmado'
                  and p.tipo_movimiento = 'pago'
                  and p.etapa_operativa = 'abono'
            ),0)::bigint as abono_confirmado
        from public.reservas r
        join lateral (
            select ex.*
            from public.reserva_estadias ex
            where ex.reserva_id = r.id
              and ex.estado_estadia = 'cancelada'
            order by ex.actualizado_en desc, ex.creado_en desc
            limit 1
        ) e on true
        join public.cabanas c on c.id = e.cabana_id
        where r.estado_reserva = 'cancelada'
          and (
              lower(coalesce(r.titular_nombre,'')) like '%' || v_busqueda || '%'
              or lower(coalesce(r.codigo_haiku,'')) like '%' || v_busqueda || '%'
              or lower(coalesce(r.cloudbeds_id,'')) like '%' || v_busqueda || '%'
              or lower(coalesce(r.titular_numero_documento,'')) like '%' || v_busqueda || '%'
          )
        order by e.fecha_ingreso desc, r.creado_en desc
        limit 20
    )
    select coalesce(jsonb_agg(to_jsonb(resultados)), '[]'::jsonb)
      into v_resultado
      from resultados;

    return v_resultado;
end;
$function$;

revoke all on function public.haiku_info_reactivacion_reserva(uuid) from public;
revoke all on function public.haiku_buscar_reservas_canceladas(text) from public;
grant execute on function public.haiku_info_reactivacion_reserva(uuid) to authenticated;
grant execute on function public.haiku_buscar_reservas_canceladas(text) to authenticated;
