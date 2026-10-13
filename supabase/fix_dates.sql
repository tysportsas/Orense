-- Convierte fechas guardadas como texto (d/m/aaaa) a ISO (aaaa-mm-dd) en
-- reports.data para fnac y fpartido. Ejecutar una vez en Supabase → SQL Editor.
update public.reports
set data = jsonb_set(
  data, '{fnac}',
  to_jsonb(to_char(to_date(data->>'fnac', 'DD/MM/YYYY'), 'YYYY-MM-DD'))
)
where data->>'fnac' ~ '^\d{1,2}/\d{1,2}/\d{4}$'
  and (split_part(data->>'fnac', '/', 2))::int between 1 and 12;

update public.reports
set data = jsonb_set(
  data, '{fpartido}',
  to_jsonb(to_char(to_date(data->>'fpartido', 'DD/MM/YYYY'), 'YYYY-MM-DD'))
)
where data->>'fpartido' ~ '^\d{1,2}/\d{1,2}/\d{4}$'
  and (split_part(data->>'fpartido', '/', 2))::int between 1 and 12;
