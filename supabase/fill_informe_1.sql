-- Parte 1 de 1. Completa informes con los datos de la hoja de Google Sheets (valoraciones, atributos por puesto, táctico, técnico, físico, psicológico, observaciones).
-- Solo escribe donde el campo está vacío. Se puede repetir sin problema.
update public.reports r
set data = r.data || v.patch::jsonb
from (values
('3321b745-e2b6-4281-af14-c65869f697ca','{"val_partido":"5. MUY IMPORTANTE"}'),
('59f1064b-64bc-48cf-b58a-6e459f0498d3','{"val_partido":"4. ALTA RELEVANCIA"}'),
('cdec4f9f-a45f-4540-9c46-4870abca639f','{"val_partido":"5. MUY IMPORTANTE","valoracion":"4.INTERESANTE"}'),
('e0f89e7b-9ed9-4b41-8ac6-ffd3eb2789ca','{"val_partido":"4. ALTA RELEVANCIA","valoracion":"5.FICHAR"}'),
('6ad48bf9-5054-46a1-abc5-183f7b8882c7','{"val_partido":"3. RELEVANCIA NORMAL","valoracion":"3.SEGUIR VIENDO"}'),
('d78250dc-bae9-4e2a-85f1-7b36c49a0d13','{"val_partido":"4. ALTA RELEVANCIA","valoracion":"4.INTERESANTE"}'),
('258ef165-e376-4962-ac25-cb8f7875d35d','{"val_partido":"4. ALTA RELEVANCIA","valoracion":"5.FICHAR"}'),
('c5af4dc0-789e-4ef3-afb8-a083d57de7a4','{"val_partido":"5. MUY IMPORTANTE","valoracion":"3.SEGUIR VIENDO"}')
) as v(id, patch)
where r.id = v.id::uuid;
