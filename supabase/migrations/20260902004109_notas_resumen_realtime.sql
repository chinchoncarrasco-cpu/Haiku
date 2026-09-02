-- HAIKU · Notas operativas del Resumen en Supabase + Realtime

grant delete on table public.notas to authenticated;

drop policy if exists notas_delete on public.notas;
create policy notas_delete
on public.notas
for delete
to authenticated
using (private.haiku_tiene_permiso('notas.gestionar'));

create unique index if not exists notas_operativas_resumen_unicas
on public.notas (fecha_operacion, cabana_id, texto)
where tipo = 'operativa_resumen';

do $$
begin
    if not exists (
        select 1
        from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'notas'
    ) then
        alter publication supabase_realtime add table public.notas;
    end if;
end;
$$;
