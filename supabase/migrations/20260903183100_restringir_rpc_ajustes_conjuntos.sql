revoke execute on function public.haiku_resumen_ajustes_unidad(uuid) from public, anon;
revoke execute on function public.haiku_aplicar_ajuste_unidad(uuid,text,text) from public, anon;
grant execute on function public.haiku_resumen_ajustes_unidad(uuid) to authenticated;
grant execute on function public.haiku_aplicar_ajuste_unidad(uuid,text,text) to authenticated;