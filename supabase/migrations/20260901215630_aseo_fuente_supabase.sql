-- HAIKU · Aseo como fuente real en Supabase
-- Cambio incremental: conserva las tablas, RLS y triggers existentes.

alter table public.aseos
    add column if not exists encargado_nombre text,
    add column if not exists revisor_nombre text;

comment on column public.aseos.encargado_nombre is
    'Nombre operativo libre de la persona encargada del aseo.';

comment on column public.aseos.revisor_nombre is
    'Nombre operativo libre de quien revisa el aseo.';

-- La interfaz de HAIKU representa una sola operación de aseo por cabaña y día.
create unique index if not exists aseos_fecha_cabana_unica
    on public.aseos (fecha, cabana_id);

alter table public.solicitudes
    add column if not exists fecha_operativa date;

comment on column public.solicitudes.fecha_operativa is
    'Fecha de operación elegida en HAIKU; no depende de la fecha de creación.';

-- Una tarjeta Aseo Express mantiene una solicitud vigente por cabaña y fecha.
-- Las solicitudes de otros flujos pueden seguir usando fecha_operativa nula.
create unique index if not exists solicitudes_fecha_cabana_categoria_unica
    on public.solicitudes (fecha_operativa, cabana_id, categoria);

create index if not exists revisiones_tipo_fecha_cabana_idx
    on public.revisiones_cabana (tipo_revision, fecha, cabana_id);

-- Ítems exclusivos de la revisión Aseo Express. No se agregan a
-- cabana_checklist_config, por lo que no aparecen en la revisión completa.
insert into public.checklist_items (
    nombre,
    categoria,
    unidad,
    criticidad,
    activo
)
select
    item.nombre,
    '🧹 ASEO EXPRESS',
    null,
    'normal',
    true
from (
    values
        ('Losa'),
        ('Llave de gas'),
        ('Té'),
        ('Café'),
        ('Té Hierbas'),
        ('Cama'),
        ('Salamandra'),
        ('Leña'),
        ('Diario'),
        ('Amenities'),
        ('Papel H.'),
        ('Toallas'),
        ('WC'),
        ('Carbón'),
        ('Fogón'),
        ('Ventanas')
) as item(nombre)
where not exists (
    select 1
    from public.checklist_items existente
    where existente.categoria = '🧹 ASEO EXPRESS'
      and existente.nombre = item.nombre
);

-- solicitudes ya tiene RLS y políticas por permisos. Se añade la misma
-- auditoría genérica usada por aseos y revisiones_cabana.
do $$
begin
    if not exists (
        select 1
        from pg_trigger
        where tgname = 'auditoria_solicitudes'
          and tgrelid = 'public.solicitudes'::regclass
          and not tgisinternal
    ) then
        create trigger auditoria_solicitudes
            after insert or update on public.solicitudes
            for each row execute function public.haiku_auditar_cambio();
    end if;
end;
$$;
