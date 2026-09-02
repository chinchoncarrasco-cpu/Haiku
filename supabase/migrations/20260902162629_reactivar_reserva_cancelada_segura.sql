create or replace function public.haiku_reactivar_reserva_cancelada(
    p_reserva_id uuid,
    p_estado_solicitado text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
    v_estado_reserva text;
    v_estadia_id uuid;
    v_cabana_id uuid;
    v_cabana_numero smallint;
    v_cabana_activa boolean;
    v_fecha_ingreso date;
    v_fecha_salida date;
    v_tipo_estadia text;
    v_checkin timestamptz;
    v_checkout timestamptz;
    v_abono bigint := 0;
    v_estado_nuevo text;
    v_solicitado text;
    v_inicio timestamptz;
    v_fin timestamptz;
begin
    if auth.uid() is null then
        raise exception 'Debe iniciar sesión para reactivar reservas' using errcode = '42501';
    end if;

    if not private.haiku_tiene_permiso('reservas.editar') then
        raise exception 'No tiene permiso para reactivar reservas' using errcode = '42501';
    end if;

    if p_reserva_id is null then
        raise exception 'Falta la reserva a reactivar';
    end if;

    select r.estado_reserva
      into v_estado_reserva
      from public.reservas r
     where r.id = p_reserva_id
     for update;

    if not found then
        raise exception 'La reserva no existe';
    end if;

    if v_estado_reserva <> 'cancelada' then
        raise exception 'Solo se pueden reactivar reservas canceladas';
    end if;

    select
        e.id,
        e.cabana_id,
        c.numero,
        c.activa,
        e.fecha_ingreso,
        e.fecha_salida,
        e.tipo_estadia,
        e.checkin_realizado_en,
        e.checkout_realizado_en
      into
        v_estadia_id,
        v_cabana_id,
        v_cabana_numero,
        v_cabana_activa,
        v_fecha_ingreso,
        v_fecha_salida,
        v_tipo_estadia,
        v_checkin,
        v_checkout
      from public.reserva_estadias e
      join public.cabanas c on c.id = e.cabana_id
     where e.reserva_id = p_reserva_id
       and e.estado_estadia = 'cancelada'
     order by e.actualizado_en desc, e.creado_en desc
     limit 1
     for update of e;

    if not found then
        raise exception 'La reserva cancelada no tiene una estadía recuperable';
    end if;

    if not v_cabana_activa then
        raise exception 'La CAB % ya no está activa; primero reasigna la reserva', v_cabana_numero;
    end if;

    if v_checkin is not null or v_checkout is not null then
        raise exception 'Esta reserva tiene movimientos de check-in/check-out y no puede reactivarse por esta vía';
    end if;

    select coalesce(sum(p.monto), 0)::bigint
      into v_abono
      from public.pagos p
     where p.reserva_id = p_reserva_id
       and p.estado = 'confirmado'
       and p.tipo_movimiento = 'pago'
       and p.etapa_operativa = 'abono';

    v_estado_nuevo := case when v_abono > 0 then 'confirmada' else 'pendiente' end;

    if p_estado_solicitado is not null and btrim(p_estado_solicitado) <> '' then
        v_solicitado := lower(btrim(p_estado_solicitado));
        if v_solicitado in ('confirmacion-pendiente', 'confirmación-pendiente', 'pendiente') then
            v_solicitado := 'pendiente';
        elsif v_solicitado = 'confirmada' then
            v_solicitado := 'confirmada';
        else
            raise exception 'Estado solicitado no válido para reactivar';
        end if;

        if v_solicitado <> v_estado_nuevo then
            if v_estado_nuevo = 'confirmada' then
                raise exception 'La reserva tiene un abono confirmado y debe reactivarse como Confirmada';
            else
                raise exception 'La reserva no tiene abono confirmado y debe reactivarse como Confirmación pendiente';
            end if;
        end if;
    end if;

    v_inicio := v_fecha_ingreso::timestamp at time zone 'America/Santiago';
    v_fin := case
        when v_tipo_estadia = 'fullday'
            then (v_fecha_ingreso + 1)::timestamp at time zone 'America/Santiago'
        else v_fecha_salida::timestamp at time zone 'America/Santiago'
    end;

    if exists (
        select 1
          from public.bloqueos_cabana b
         where b.cabana_id = v_cabana_id
           and b.estado = 'activo'
           and tstzrange(b.desde, coalesce(b.hasta, 'infinity'::timestamptz), '[)')
               && tstzrange(v_inicio, v_fin, '[)')
    ) then
        raise exception 'La CAB % está bloqueada en las fechas de esta reserva. Edítala o reasígnala antes de reactivar', v_cabana_numero;
    end if;

    if exists (
        select 1
          from public.reserva_estadias e
         where e.cabana_id = v_cabana_id
           and e.id <> v_estadia_id
           and e.estado_estadia not in ('cancelada','no_show')
           and not (e.tipo_estadia = 'fullday' and e.fullday_liberado_en is not null)
           and (
               (
                   v_tipo_estadia = 'alojamiento'
                   and e.tipo_estadia = 'alojamiento'
                   and daterange(e.fecha_ingreso, e.fecha_salida, '[)')
                       && daterange(v_fecha_ingreso, v_fecha_salida, '[)')
               )
               or (
                   v_tipo_estadia = 'alojamiento'
                   and e.tipo_estadia = 'fullday'
                   and e.fecha_ingreso >= v_fecha_ingreso
                   and e.fecha_ingreso < v_fecha_salida
               )
               or (
                   v_tipo_estadia = 'fullday'
                   and e.tipo_estadia = 'alojamiento'
                   and v_fecha_ingreso >= e.fecha_ingreso
                   and v_fecha_ingreso < e.fecha_salida
               )
               or (
                   v_tipo_estadia = 'fullday'
                   and e.tipo_estadia = 'fullday'
                   and e.fecha_ingreso = v_fecha_ingreso
               )
           )
    ) then
        raise exception 'La CAB % ya tiene otra reserva en esas fechas. Edítala o reasígnala antes de reactivar', v_cabana_numero;
    end if;

    update public.reserva_estadias
       set estado_estadia = v_estado_nuevo,
           fullday_liberado_en = null,
           fullday_liberado_por = null,
           actualizado_en = now()
     where id = v_estadia_id;

    update public.reservas
       set estado_reserva = v_estado_nuevo
     where id = p_reserva_id;

    return jsonb_build_object(
        'reserva_id', p_reserva_id,
        'estadia_id', v_estadia_id,
        'cabana_numero', v_cabana_numero,
        'fecha_ingreso', v_fecha_ingreso,
        'fecha_salida', v_fecha_salida,
        'tipo_estadia', v_tipo_estadia,
        'abono_confirmado', v_abono,
        'estado', v_estado_nuevo,
        'reactivada', true
    );
end;
$function$;

revoke all on function public.haiku_reactivar_reserva_cancelada(uuid, text) from public;
grant execute on function public.haiku_reactivar_reserva_cancelada(uuid, text) to authenticated;
