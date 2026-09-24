-- Método Orense de Scouting — esquema de Supabase
-- Ejecutar completo en: Supabase → SQL Editor → New query → Run

-- 1) Tabla principal: un informe por fila. `data` guarda las mismas
--    respuestas que el formulario (los mismos ids que en lib/formModel.ts).
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  created_by uuid references auth.users (id),
  updated_by uuid references auth.users (id),
  data jsonb not null default '{}'::jsonb
);

-- Búsquedas y filtros rápidos sobre el contenido del informe.
create index if not exists reports_data_gin on public.reports using gin (data);
create index if not exists reports_created_at_idx on public.reports (created_at desc);

-- 2) Extensión unaccent y vista de "jugadores"
create extension if not exists unaccent;

create or replace view public.players_view as
select
  lower(unaccent(coalesce(data->>'nombre', ''))) || '|' || coalesce(data->>'fnac', '') as player_key,
  (array_agg(data->>'nombre' order by created_at desc))[1]       as nombre,
  (array_agg(data->>'categoria' order by created_at desc))[1]    as categoria,
  (array_agg(data->>'club' order by created_at desc))[1]         as club,
  (array_agg(data->>'foto' order by created_at desc) filter (where data->>'foto' is not null))[1] as foto,
  count(*)                                                        as n_informes,
  max(created_at)                                                 as last_report_at
from public.reports
group by 1;

-- 3) Seguridad a nivel de fila (RLS). Regla por defecto: cualquier
--    observador autenticado puede ver, crear y editar todos los informes
--    (así se comparten entre todo el equipo). Si prefieres que cada
--    observador solo pueda editar los suyos, cambia las políticas de
--    "update"/"delete" para exigir `created_by = auth.uid()`.
alter table public.reports enable row level security;

create policy "Observadores autenticados pueden leer todo"
  on public.reports for select
  to authenticated
  using (true);

create policy "Observadores autenticados pueden crear informes"
  on public.reports for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Observadores autenticados pueden editar cualquier informe"
  on public.reports for update
  to authenticated
  using (true)
  with check (true);

create policy "Observadores autenticados pueden borrar cualquier informe"
  on public.reports for delete
  to authenticated
  using (true);

-- 4) Almacenamiento: fotos de jugadores y adjuntos de los informes N4/N5.
--    (Crea los buckets desde el panel: Storage → New bucket → nombre
--    exacto "player-photos" y "attachments", ambos privados.)
insert into storage.buckets (id, name, public)
  values ('player-photos', 'player-photos', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
  values ('attachments', 'attachments', false)
  on conflict (id) do nothing;

create policy "Observadores autenticados leen fotos"
  on storage.objects for select to authenticated
  using (bucket_id = 'player-photos');
create policy "Observadores autenticados suben fotos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'player-photos');
create policy "Observadores autenticados borran fotos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'player-photos');

create policy "Observadores autenticados leen adjuntos"
  on storage.objects for select to authenticated
  using (bucket_id = 'attachments');
create policy "Observadores autenticados suben adjuntos"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments');
create policy "Observadores autenticados borran adjuntos"
  on storage.objects for delete to authenticated
  using (bucket_id = 'attachments');

-- 5) Cuentas de los observadores: Supabase Auth no permite crear usuarios
--    por SQL con contraseña en texto plano de forma soportada. Créalos
--    desde el panel: Authentication → Users → Add user, uno por cada
--    observador (Daniel Arango, Javier Semeler...), con su correo y una
--    contraseña provisional que cada quien cambiará en su primer ingreso.
--    No hay registro público: la app solo tiene pantalla de inicio de
--    sesión, nunca de "crear cuenta".
