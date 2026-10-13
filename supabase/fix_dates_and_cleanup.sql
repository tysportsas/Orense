-- Ejecutar en Supabase → SQL Editor. Ejecuta cada bloque por separado.

-- BLOQUE 1: fechas en serial de Excel (p. ej. 37062) → aaaa-mm-dd.
-- Si "partido" quedó como serial y no hay fpartido, ese número es la fecha del partido.
update public.reports
set data = jsonb_set(data, '{fnac}',
  to_jsonb(to_char(date '1899-12-30' + floor((data->>'fnac')::numeric)::int, 'YYYY-MM-DD')))
where case when data->>'fnac' ~ '^\d+(\.\d+)?$' then (data->>'fnac')::numeric end between 20000 and 80000;

update public.reports
set data = jsonb_set(data, '{fpartido}',
  to_jsonb(to_char(date '1899-12-30' + floor((data->>'fpartido')::numeric)::int, 'YYYY-MM-DD')))
where case when data->>'fpartido' ~ '^\d+(\.\d+)?$' then (data->>'fpartido')::numeric end between 20000 and 80000;

update public.reports
set data = jsonb_set(
  jsonb_set(data, '{fpartido}',
    to_jsonb(to_char(date '1899-12-30' + floor((data->>'partido')::numeric)::int, 'YYYY-MM-DD'))),
  '{partido}', '""')
where coalesce(data->>'fpartido', '') = ''
  and case when data->>'partido' ~ '^\d+(\.\d+)?$' then (data->>'partido')::numeric end between 20000 and 80000;

-- BLOQUE 2 (vista previa): filas basura de importaciones anteriores
-- (personal del club de la primera pestaña y fragmentos de comentarios).
select id, created_at, data->>'nombre' as nombre, data->>'fnac' as fnac
from public.reports
where (data ? 'area' and data ? 'cargo')
   or (data->>'fnac' is not null
       and data->>'fnac' !~ '^\d{4}-\d{2}-\d{2}$'
       and data->>'fnac' !~ '^\d+(\.\d+)?$')
   or (data->>'fnac' is null and data->>'partido' is null and data->>'club' is null);

-- BLOQUE 3: borra esas mismas filas (ejecutar solo si la vista previa es correcta).
delete from public.reports
where (data ? 'area' and data ? 'cargo')
   or (data->>'fnac' is not null
       and data->>'fnac' !~ '^\d{4}-\d{2}-\d{2}$'
       and data->>'fnac' !~ '^\d+(\.\d+)?$')
   or (data->>'fnac' is null and data->>'partido' is null and data->>'club' is null);
