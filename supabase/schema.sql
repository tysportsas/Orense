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

create or replace function public.normalize_player_name(player_name text)
returns text
language sql
immutable
parallel safe
set search_path = public, extensions
as $$
  select lower(btrim(unaccent(coalesce(player_name, ''))));
$$;

create index if not exists reports_player_identity_idx
  on public.reports (
    public.normalize_player_name(data->>'nombre'),
    coalesce(data->>'fnac', '')
  );

create or replace view public.players_view with (security_invoker = true) as
select
  public.normalize_player_name(data->>'nombre') || '|' || coalesce(data->>'fnac', '') as player_key,
  (array_agg(data->>'nombre' order by created_at desc))[1]       as nombre,
  (array_agg(data->>'categoria' order by created_at desc))[1]    as categoria,
  (array_agg(data->>'club' order by created_at desc))[1]         as club,
  (array_agg(data->>'foto' order by created_at desc) filter (where data->>'foto' is not null))[1] as foto,
  count(*)                                                        as n_informes,
  max(created_at)                                                 as last_report_at,
  (array_agg(data order by created_at desc))[1]                  as latest_data
from public.reports
group by 1;

create or replace function public.reports_for_player(p_player_key text)
returns setof public.reports
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select r.*
  from public.reports r
  where public.normalize_player_name(r.data->>'nombre') || '|' || coalesce(r.data->>'fnac', '') = p_player_key
  order by r.created_at desc;
$$;

revoke all on function public.reports_for_player(text) from public;
grant execute on function public.reports_for_player(text) to authenticated;
grant execute on function public.reports_for_player(text) to anon;

-- 3) Los permisos se basan en app_metadata, no editable por el usuario.
alter table public.reports enable row level security;

drop policy if exists "Observadores autenticados pueden leer todo" on public.reports;
drop policy if exists "Observadores autenticados pueden crear informes" on public.reports;
drop policy if exists "Observadores autenticados pueden editar cualquier informe" on public.reports;
drop policy if exists "Observadores autenticados pueden borrar cualquier informe" on public.reports;
drop policy if exists "reports_select_authenticated" on public.reports;
drop policy if exists "reports_insert_scout_admin" on public.reports;
drop policy if exists "reports_update_scout_admin" on public.reports;
drop policy if exists "reports_delete_admin" on public.reports;

create policy "reports_select_authenticated"
  on public.reports for select
  to authenticated
  using (true);

-- Acceso público para la app sin inicio de sesión. Esto hace visibles los
-- informes a cualquier visitante; los usuarios anónimos solo pueden insertar.
drop policy if exists "reports_select_anon" on public.reports;
drop policy if exists "reports_insert_anon" on public.reports;
create policy "reports_select_anon"
  on public.reports for select
  to anon
  using (true);

create policy "reports_insert_anon"
  on public.reports for insert
  to anon
  with check (created_by is null);

grant select, insert on public.reports to anon;
grant select on public.players_view to anon;

create policy "reports_insert_scout_admin"
  on public.reports for insert
  to authenticated
  with check (
    auth.uid() = created_by
    and coalesce(auth.jwt()->'app_metadata'->>'role', 'viewer') in ('admin', 'scout')
  );

create policy "reports_update_scout_admin"
  on public.reports for update
  to authenticated
  using (coalesce(auth.jwt()->'app_metadata'->>'role', 'viewer') in ('admin', 'scout'))
  with check (
    coalesce(auth.jwt()->'app_metadata'->>'role', 'viewer') in ('admin', 'scout')
    and updated_by = auth.uid()
  );

create policy "reports_delete_admin"
  on public.reports for delete
  to authenticated
  using (coalesce(auth.jwt()->'app_metadata'->>'role', 'viewer') = 'admin');

-- 4) Almacenamiento: fotos de jugadores y adjuntos de los informes N4/N5.
--    (Crea los buckets desde el panel: Storage → New bucket → nombre
--    exacto "player-photos" y "attachments", ambos privados.)
insert into storage.buckets (id, name, public)
  values ('player-photos', 'player-photos', false)
  on conflict (id) do nothing;
insert into storage.buckets (id, name, public)
  values ('attachments', 'attachments', false)
  on conflict (id) do nothing;

drop policy if exists "Observadores autenticados leen fotos" on storage.objects;
drop policy if exists "Observadores autenticados suben fotos" on storage.objects;
drop policy if exists "Observadores autenticados borran fotos" on storage.objects;
drop policy if exists "Observadores autenticados leen adjuntos" on storage.objects;
drop policy if exists "Observadores autenticados suben adjuntos" on storage.objects;
drop policy if exists "Observadores autenticados borran adjuntos" on storage.objects;
drop policy if exists "storage_read_authenticated" on storage.objects;
drop policy if exists "storage_insert_scout_admin" on storage.objects;
drop policy if exists "storage_delete_admin" on storage.objects;

create policy "storage_read_authenticated"
  on storage.objects for select to authenticated
  using (bucket_id in ('player-photos', 'attachments'));
create policy "storage_insert_scout_admin"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('player-photos', 'attachments')
    and coalesce(auth.jwt()->'app_metadata'->>'role', 'viewer') in ('admin', 'scout')
  );
create policy "storage_delete_admin"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('player-photos', 'attachments')
    and coalesce(auth.jwt()->'app_metadata'->>'role', 'viewer') = 'admin'
  );

-- 5) Cuentas de los observadores: Supabase Auth no permite crear usuarios
--    por SQL con contraseña en texto plano de forma soportada. Créalos
--    desde el panel: Authentication → Users → Add user, uno por cada
--    observador (Daniel Arango, Javier Semeler...), con su correo y una
--    contraseña provisional que cada quien cambiará en su primer ingreso.
--    En App Metadata asigna `role` (no User Metadata, editable por el usuario):
--      - admin: acceso completo.
--      - scout: consulta, crea y edita informes; ve dashboard/campograma.
--      - viewer: solo lectura.
--    Si no se define, la app aplica viewer. Asigna el primer admin desde
--    el panel de Supabase antes de iniciar sesión.
--    No hay registro público: la app solo tiene pantalla de inicio de
--    sesión, nunca de "crear cuenta".
