-- Elimina informes duplicados importados el 30/09 que quedaron SIN nombre de partido.
-- Solo se borra un informe si existe OTRO informe del mismo jugador (nombre + fecha de nacimiento)
-- y la misma fecha de partido que sí tiene el nombre del partido.

-- BLOQUE 1: vista previa (debe mostrar unas 1278 filas). Ejecútalo primero.
select count(*) as a_borrar
from public.reports r
where coalesce(r.data->>'fpartido','') <> ''
  and coalesce(r.data->>'partido','') = ''
  and exists (
    select 1 from public.reports o
    where o.id <> r.id
      and lower(trim(o.data->>'nombre')) = lower(trim(r.data->>'nombre'))
      and coalesce(o.data->>'fnac','') = coalesce(r.data->>'fnac','')
      and o.data->>'fpartido' = r.data->>'fpartido'
      and coalesce(o.data->>'partido','') <> ''
  );

-- BLOQUE 2: borrado. Ejecútalo después de revisar el número del bloque 1.
delete from public.reports r
where coalesce(r.data->>'fpartido','') <> ''
  and coalesce(r.data->>'partido','') = ''
  and exists (
    select 1 from public.reports o
    where o.id <> r.id
      and lower(trim(o.data->>'nombre')) = lower(trim(r.data->>'nombre'))
      and coalesce(o.data->>'fnac','') = coalesce(r.data->>'fnac','')
      and o.data->>'fpartido' = r.data->>'fpartido'
      and coalesce(o.data->>'partido','') <> ''
  );
