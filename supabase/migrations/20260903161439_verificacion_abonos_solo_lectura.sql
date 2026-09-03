-- HAIKU · Verificación de abonos en modo solo lectura
-- Los abonos históricos ya confirmados se preservan como verificados.

update public.pagos
   set verificado_por = creado_por,
       verificado_en = coalesce(fecha_pago, creado_en, now()),
       datos_origen = coalesce(datos_origen, '{}'::jsonb) || jsonb_build_object(
           'verificacion_migrada', true,
           'verificacion_migrada_en', now()
       )
 where tipo_movimiento = 'pago'
   and etapa_operativa = 'abono'
   and estado = 'confirmado'
   and verificado_en is null;

create or replace function public.haiku_verificar_abono(p_pago_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public','private','pg_temp'
as $function$
declare
    v_pago public.pagos%rowtype;
    v_cantidad integer := 0;
begin
    if auth.uid() is null then
        raise exception 'Debe iniciar sesión para verificar abonos';
    end if;

    if not private.haiku_tiene_permiso('pagos.verificar') then
        raise exception 'Tu usuario no tiene permiso para verificar abonos';
    end if;

    select *
      into v_pago
      from public.pagos
     where id = p_pago_id
     for update;

    if not found then
        raise exception 'El abono no existe';
    end if;

    if v_pago.tipo_movimiento <> 'pago'
       or v_pago.etapa_operativa <> 'abono'
       or v_pago.estado <> 'confirmado' then
        raise exception 'El movimiento seleccionado no es un abono confirmado';
    end if;

    if v_pago.pago_grupo_id is not null then
        update public.pagos
           set verificado_por = auth.uid(),
               verificado_en = coalesce(verificado_en, now()),
               datos_origen = coalesce(datos_origen,'{}'::jsonb) || jsonb_build_object(
                   'verificacion_abono', true,
                   'verificacion_abono_en', now()
               )
         where pago_grupo_id = v_pago.pago_grupo_id
           and tipo_movimiento = 'pago'
           and etapa_operativa = 'abono'
           and estado = 'confirmado';
        get diagnostics v_cantidad = row_count;
    else
        update public.pagos
           set verificado_por = auth.uid(),
               verificado_en = coalesce(verificado_en, now()),
               datos_origen = coalesce(datos_origen,'{}'::jsonb) || jsonb_build_object(
                   'verificacion_abono', true,
                   'verificacion_abono_en', now()
               )
         where id = p_pago_id;
        get diagnostics v_cantidad = row_count;
    end if;

    return jsonb_build_object(
        'pago_id', p_pago_id,
        'pago_grupo_id', v_pago.pago_grupo_id,
        'verificados', v_cantidad,
        'verificado_por', auth.uid(),
        'verificado_en', now()
    );
end;
$function$;

revoke all on function public.haiku_verificar_abono(uuid) from public;
grant execute on function public.haiku_verificar_abono(uuid) to authenticated;
