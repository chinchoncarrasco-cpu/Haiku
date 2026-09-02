-- HAIKU · Realtime para la verdad financiera de Pagos pendientes

do $$
declare
    tabla text;
begin
    foreach tabla in array array[
        'pagos',
        'pago_aplicaciones',
        'cargos',
        'reservas',
        'reserva_estadias'
    ]
    loop
        if not exists (
            select 1
            from pg_publication_tables
            where pubname = 'supabase_realtime'
              and schemaname = 'public'
              and tablename = tabla
        ) then
            execute format(
                'alter publication supabase_realtime add table public.%I',
                tabla
            );
        end if;
    end loop;
end;
$$;
