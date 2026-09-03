alter table public.pagos
    add column if not exists pago_grupo_id uuid;

create index if not exists pagos_pago_grupo_id_idx
    on public.pagos (pago_grupo_id)
    where pago_grupo_id is not null;

create or replace function public.haiku_finanzas_grupo(p_reserva_id uuid)
returns jsonb
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
    v_grupo_id uuid;
    v_titular text;
    v_total bigint := 0;
    v_abonado bigint := 0;
    v_saldo bigint := 0;
    v_servicios bigint := 0;
    v_miembros jsonb := '[]'::jsonb;
begin
    if auth.uid() is null then
        raise exception 'Debe iniciar sesión para consultar finanzas';
    end if;

    select r.grupo_reserva_id, r.titular_nombre
      into v_grupo_id, v_titular
      from public.reservas r
     where r.id = p_reserva_id;

    if not found then
        raise exception 'Reserva no encontrada';
    end if;

    if v_grupo_id is null then
        return jsonb_build_object(
            'es_grupo', false,
            'reserva_id', p_reserva_id
        );
    end if;

    with miembros as (
        select r.id
          from public.reservas r
         where r.grupo_reserva_id = v_grupo_id
    )
    select
        coalesce(sum(case when ec.tipo_cargo='alojamiento' and ec.estado='activo' then ec.monto_ajustado else 0 end),0)::bigint,
        coalesce(sum(case when ec.tipo_cargo='alojamiento' and ec.estado='activo' then ec.aplicado_neto else 0 end),0)::bigint,
        coalesce(sum(case when ec.tipo_cargo='alojamiento' and ec.estado='activo' then ec.saldo_cargo else 0 end),0)::bigint,
        coalesce(sum(case when ec.tipo_cargo='servicio' and ec.estado='activo' then ec.saldo_cargo else 0 end),0)::bigint
      into v_total, v_abonado, v_saldo, v_servicios
      from public.vista_estado_cargos ec
     where ec.reserva_id in (select id from miembros);

    select coalesce(jsonb_agg(
        jsonb_build_object(
            'reserva_id', x.reserva_id,
            'cabana', x.numero,
            'nombre', x.nombre,
            'saldo_alojamiento', x.saldo_alojamiento
        ) order by x.numero
    ), '[]'::jsonb)
      into v_miembros
      from (
        select r.id as reserva_id,
               min(c.numero) as numero,
               min(c.nombre) as nombre,
               coalesce(sum(case when ec.tipo_cargo='alojamiento' and ec.estado='activo' then ec.saldo_cargo else 0 end),0)::bigint as saldo_alojamiento
          from public.reservas r
          left join public.reserva_estadias re on re.reserva_id = r.id
          left join public.cabanas c on c.id = re.cabana_id
          left join public.vista_estado_cargos ec on ec.reserva_id = r.id
         where r.grupo_reserva_id = v_grupo_id
         group by r.id
      ) x;

    return jsonb_build_object(
        'es_grupo', true,
        'grupo_reserva_id', v_grupo_id,
        'titular', v_titular,
        'total_alojamiento', v_total,
        'abonado_alojamiento', v_abonado,
        'saldo_alojamiento', v_saldo,
        'servicios_pendientes', v_servicios,
        'miembros', v_miembros
    );
end;
$function$;

create or replace function public.haiku_registrar_pago_grupo(
    p_reserva_id uuid,
    p_monto bigint,
    p_medio_pago text,
    p_etapa_operativa text default 'abono'::text,
    p_fecha_pago timestamp with time zone default now(),
    p_folio text default null::text,
    p_codigo_autorizacion text default null::text,
    p_bove text default null::text,
    p_referencia_externa text default null::text,
    p_observaciones text default null::text
)
returns jsonb
language plpgsql
set search_path to 'public','pg_temp'
as $function$
declare
    v_grupo_id uuid;
    v_titular text;
    v_documento text;
    v_total_saldo bigint := 0;
    v_restante bigint;
    v_asignado bigint := 0;
    v_pago_grupo_id uuid := gen_random_uuid();
    v_item record;
    v_parte bigint;
    v_resultado jsonb;
    v_pago_id uuid;
    v_distribucion jsonb := '[]'::jsonb;
    v_indice integer := 0;
    v_cantidad integer := 0;
begin
    if auth.uid() is null then
        raise exception 'Debe iniciar sesión para registrar pagos';
    end if;

    if p_monto is null or p_monto <= 0 then
        raise exception 'El monto debe ser mayor que cero';
    end if;

    select r.grupo_reserva_id, r.titular_nombre, r.titular_numero_documento
      into v_grupo_id, v_titular, v_documento
      from public.reservas r
     where r.id = p_reserva_id;

    if not found then
        raise exception 'Reserva no encontrada';
    end if;

    if v_grupo_id is null then
        v_resultado := public.haiku_registrar_pago(
            p_reserva_id => p_reserva_id,
            p_monto => p_monto,
            p_medio_pago => p_medio_pago,
            p_etapa_operativa => p_etapa_operativa,
            p_fecha_pago => p_fecha_pago,
            p_folio => p_folio,
            p_codigo_autorizacion => p_codigo_autorizacion,
            p_bove => p_bove,
            p_referencia_externa => p_referencia_externa,
            p_observaciones => p_observaciones,
            p_aplicaciones => '[]'::jsonb,
            p_modo_aplicacion => 'alojamiento'
        );
        return jsonb_build_object(
            'es_grupo', false,
            'monto', p_monto,
            'pago_id', v_resultado->>'pago_id'
        );
    end if;

    with saldos as (
        select r.id as reserva_id,
               min(c.numero) as numero,
               coalesce(sum(case when ec.tipo_cargo='alojamiento' and ec.estado='activo' then ec.saldo_cargo else 0 end),0)::bigint as saldo
          from public.reservas r
          left join public.reserva_estadias re on re.reserva_id = r.id
          left join public.cabanas c on c.id = re.cabana_id
          left join public.vista_estado_cargos ec on ec.reserva_id = r.id
         where r.grupo_reserva_id = v_grupo_id
         group by r.id
    )
    select coalesce(sum(saldo),0)::bigint,
           count(*) filter (where saldo > 0)::integer
      into v_total_saldo, v_cantidad
      from saldos;

    if v_total_saldo <= 0 then
        raise exception 'La reserva conjunta no tiene saldo de alojamiento pendiente';
    end if;

    if p_monto > v_total_saldo then
        raise exception 'El pago supera el saldo conjunto actual (%)', v_total_saldo;
    end if;

    v_restante := p_monto;

    for v_item in
        with saldos as (
            select r.id as reserva_id,
                   min(c.numero) as numero,
                   coalesce(sum(case when ec.tipo_cargo='alojamiento' and ec.estado='activo' then ec.saldo_cargo else 0 end),0)::bigint as saldo
              from public.reservas r
              left join public.reserva_estadias re on re.reserva_id = r.id
              left join public.cabanas c on c.id = re.cabana_id
              left join public.vista_estado_cargos ec on ec.reserva_id = r.id
             where r.grupo_reserva_id = v_grupo_id
             group by r.id
        )
        select * from saldos where saldo > 0 order by numero nulls last, reserva_id
    loop
        v_indice := v_indice + 1;

        if v_indice = v_cantidad then
            v_parte := v_restante;
        else
            v_parte := floor((p_monto::numeric * v_item.saldo::numeric) / v_total_saldo::numeric)::bigint;
            v_parte := least(v_parte, v_item.saldo, v_restante);
        end if;

        if v_parte <= 0 then
            continue;
        end if;

        v_resultado := public.haiku_registrar_pago(
            p_reserva_id => v_item.reserva_id,
            p_monto => v_parte,
            p_medio_pago => p_medio_pago,
            p_etapa_operativa => p_etapa_operativa,
            p_fecha_pago => p_fecha_pago,
            p_folio => p_folio,
            p_codigo_autorizacion => p_codigo_autorizacion,
            p_bove => p_bove,
            p_referencia_externa => p_referencia_externa,
            p_observaciones => concat_ws(' · ', nullif(btrim(coalesce(p_observaciones,'')),''), 'Pago conjunto'),
            p_aplicaciones => '[]'::jsonb,
            p_modo_aplicacion => 'alojamiento'
        );

        v_pago_id := (v_resultado->>'pago_id')::uuid;

        update public.pagos
           set pago_grupo_id = v_pago_grupo_id,
               pagador_nombre = coalesce(v_titular, pagador_nombre),
               pagador_documento = coalesce(v_documento, pagador_documento)
         where id = v_pago_id;

        v_distribucion := v_distribucion || jsonb_build_array(
            jsonb_build_object(
                'reserva_id', v_item.reserva_id,
                'cabana', v_item.numero,
                'monto', v_parte,
                'pago_id', v_pago_id
            )
        );

        v_asignado := v_asignado + v_parte;
        v_restante := v_restante - v_parte;
    end loop;

    if v_restante <> 0 or v_asignado <> p_monto then
        raise exception 'No fue posible distribuir completamente el pago conjunto';
    end if;

    if p_etapa_operativa = 'abono' then
        update public.reservas
           set estado_reserva = 'confirmada'
         where grupo_reserva_id = v_grupo_id
           and estado_reserva = 'pendiente';

        update public.reserva_estadias re
           set estado_estadia = 'confirmada'
         where re.reserva_id in (
             select id from public.reservas where grupo_reserva_id = v_grupo_id
         )
           and re.estado_estadia = 'pendiente';
    end if;

    return jsonb_build_object(
        'es_grupo', true,
        'grupo_reserva_id', v_grupo_id,
        'pago_grupo_id', v_pago_grupo_id,
        'monto', p_monto,
        'distribucion', v_distribucion
    );
end;
$function$;
