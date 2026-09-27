// lib/reports.ts
//
// Toda la comunicación con Supabase (tabla `reports`, vista
// `players_view` y los buckets de Storage) pasa por aquí. Los
// componentes de React no llaman a Supabase directamente.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReportData } from './formModel';
import { norm } from './formModel';

export interface ReportRow {
  id: string;
  created_at: string;
  updated_at: string | null;
  created_by: string | null;
  updated_by: string | null;
  data: ReportData;
}

export interface PlayerRow {
  player_key: string;
  nombre: string;
  categoria: string | null;
  club: string | null;
  foto: string | null;
  n_informes: number;
  last_report_at: string;
}

export async function listAllReports(supabase: SupabaseClient): Promise<ReportRow[]> {
  const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return data as ReportRow[];
}

export async function listPlayers(supabase: SupabaseClient): Promise<PlayerRow[]> {
  const { data, error } = await supabase
    .from('players_view')
    .select('*')
    .order('last_report_at', { ascending: false });
  if (error) throw error;
  return data as PlayerRow[];
}

export async function listReportsForPlayer(supabase: SupabaseClient, playerKey: string): Promise<ReportRow[]> {
  // player_key = nombre normalizado + fecha de nacimiento; se recalcula en
  // el cliente porque Postgres no puede indexar fácilmente esa expresión
  // sobre cada fila sin la vista, así que traemos todo y filtramos aquí
  // solo cuando el equipo es pequeño. Para equipos grandes, conviene mover
  // este filtro a una función RPC en Supabase.
  const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  const rows = data as ReportRow[];
  return rows.filter((r) => keyOf(r.data) === playerKey);
}

export async function getReport(supabase: SupabaseClient, id: string): Promise<ReportRow | null> {
  const { data, error } = await supabase.from('reports').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as ReportRow | null;
}

export async function createReport(supabase: SupabaseClient, data: ReportData): Promise<ReportRow> {
  let userId: string | null = null;
  try {
    const { data: authData } = await supabase.auth.getUser();
    userId = authData.user?.id ?? null;
  } catch {
    userId = null;
  }

  const { data: row, error } = await supabase
    .from('reports')
    .insert({ data, created_by: userId })
    .select()
    .single();
  if (error) throw error;
  return row as ReportRow;
}

export async function updateReport(supabase: SupabaseClient, id: string, data: ReportData): Promise<ReportRow> {
  let userId: string | null = null;
  try {
    const { data: authData } = await supabase.auth.getUser();
    userId = authData.user?.id ?? null;
  } catch {
    userId = null;
  }

  const { data: row, error } = await supabase
    .from('reports')
    .update({ data, updated_at: new Date().toISOString(), updated_by: userId })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return row as ReportRow;
}

export async function deleteReport(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from('reports').delete().eq('id', id);
  if (error) throw error;
}

function slugFile(name: string) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9.]+/g, '-')
    .toLowerCase();
}

/** Sube una foto de jugador y devuelve una URL firmada temporal para mostrarla. */
export async function uploadPlayerPhoto(supabase: SupabaseClient, file: File): Promise<string> {
  const path = `${crypto.randomUUID()}-${slugFile(file.name)}`;
  const { error } = await supabase.storage.from('player-photos').upload(path, file, { upsert: false });
  if (error) throw error;
  return path; // se guarda solo la ruta en `data.foto`; la URL firmada se pide al mostrarla
}

export async function signedPhotoUrl(supabase: SupabaseClient, path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path; // ya es una URL (p. ej. `foto_url`)
  const { data, error } = await supabase.storage.from('player-photos').createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

export async function uploadAttachment(supabase: SupabaseClient, reportId: string, file: File) {
  const path = `${reportId}/${crypto.randomUUID()}-${slugFile(file.name)}`;
  const { error } = await supabase.storage.from('attachments').upload(path, file, { upsert: false });
  if (error) throw error;
  return { name: file.name, size: file.size, path };
}

export async function signedAttachmentUrl(supabase: SupabaseClient, path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage.from('attachments').createSignedUrl(path, expiresIn);
  if (error) return null;
  return data.signedUrl;
}

export function keyOf(d: ReportData): string {
  return norm(d.nombre || '') + '|' + (d.fnac || '');
}

export interface ObservedPlayerOption {
  key: string;
  nombre: string;
  club?: string;
  categoria?: string;
  n_informes: number;
  latestData: ReportData;
}

export async function getObservedPlayersOptions(supabase: SupabaseClient): Promise<ObservedPlayerOption[]> {
  const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  const rows = data as ReportRow[];

  const playerMap = new Map<string, ObservedPlayerOption>();
  for (const r of rows) {
    const k = keyOf(r.data);
    if (!k || !r.data.nombre) continue;
    if (!playerMap.has(k)) {
      playerMap.set(k, {
        key: k,
        nombre: r.data.nombre,
        club: r.data.club,
        categoria: r.data.categoria,
        n_informes: 1,
        latestData: r.data
      });
    } else {
      const existing = playerMap.get(k)!;
      existing.n_informes++;
    }
  }

  return Array.from(playerMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
}
