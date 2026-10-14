-- Elimina informes antiguos sin nombre de partido (copias incompletas) que ya tienen su informe completo
-- (mismo jugador, fecha de nacimiento, fecha de partido y tipo de informe).
delete from public.reports
where id in (
'42a78f38-852f-45e8-a0d8-94173ac3c91a',
'ec5d1cd0-247d-4c3e-9e19-4468abbffbb1',
'a0a8797e-18e1-482c-a9e9-55bead62a765',
'5f38cdd0-dc65-4747-ae8b-b0a9dbbd241e',
'c39379d6-45d7-45f8-82df-669d5e84099e'
);

select count(*) as informes_restantes from public.reports;
