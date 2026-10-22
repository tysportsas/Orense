-- Convierte la valoración institucional (carga en presupuesto, salario, comisiones, otros pagos, total operación)
-- de la escala antigua 2-4-6-8-10 a la escala 1-5. Solo afecta valores pares mayores a 1 que sean > 5 o iguales a 2 o 4.
-- Ejecutar UNA sola vez.
update public.reports r
set data = r.data || (
  select coalesce(jsonb_object_agg(k, to_jsonb(((r.data->>k)::numeric / 2)::int)), '{}'::jsonb)
  from unnest(array['ins_pres','ins_salario','ins_comisiones','ins_otros','ins_total']) k
  where jsonb_typeof(r.data->k) = 'number' and (r.data->>k)::numeric in (2,4,6,8,10)
)
where r.data ?| array['ins_pres','ins_salario','ins_comisiones','ins_otros','ins_total'];
