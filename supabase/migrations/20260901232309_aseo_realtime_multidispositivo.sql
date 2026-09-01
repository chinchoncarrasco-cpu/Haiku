-- HAIKU · Realtime multidispositivo para Aseo
-- Permite que cambios operativos se propaguen entre PC/celular sin recargar.

do $$
begin
    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'aseos'
    ) then
        alter publication supabase_realtime add table public.aseos;
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'solicitudes'
    ) then
        alter publication supabase_realtime add table public.solicitudes;
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'revisiones_cabana'
    ) then
        alter publication supabase_realtime add table public.revisiones_cabana;
    end if;

    if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime'
          and schemaname = 'public'
          and tablename = 'revision_items'
    ) then
        alter publication supabase_realtime add table public.revision_items;
    end if;
end;
$$;
