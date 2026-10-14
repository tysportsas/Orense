import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { bulkInsertReports, parseCSV } from '@/lib/importExport';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1Ew3tPNSSDZB2a9ZJPuEg-ATK1sX8-KyPs0mK8uRtuPk';
const SHEET_GID = process.env.GOOGLE_SHEET_GID || '985917515';
const MIN_INTERVAL_MS = 2 * 60 * 1000;

let lastRun = 0;
let lastResult: unknown = null;
let running = false;

/** Lee la hoja de Google Sheets en vivo y agrega a la base los informes que aún no existen. */
export async function GET(req: NextRequest) {
  const dryRun = req.nextUrl.searchParams.get('dry') === '1';
  const force = req.nextUrl.searchParams.get('force') === '1';

  if (!dryRun && !force && lastResult && Date.now() - lastRun < MIN_INTERVAL_MS) {
    return NextResponse.json({ ...(lastResult as object), cached: true });
  }
  if (running) return NextResponse.json({ ok: true, busy: true });
  running = true;

  try {
    const res = await fetch(
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`,
      { cache: 'no-store', redirect: 'follow' }
    );
    if (!res.ok) throw new Error(`Google Sheets respondió ${res.status}. ¿La hoja sigue compartida por enlace?`);
    const rows = parseCSV(await res.text());
    const valid = rows.filter((r) => r.isValid).map((r) => r.data);

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false } }
    );

    const result = await bulkInsertReports(supabase, valid, undefined, {
      updateExisting: !!serviceKey,
      dryRun,
    });
    const body = {
      ok: true,
      dryRun,
      filasHoja: rows.length,
      filasInvalidas: rows.length - valid.length,
      nuevos: result.success,
      actualizados: result.updated,
      yaExistian: result.skipped,
      fallidos: result.failed,
      errores: result.errors.slice(0, 5),
      at: new Date().toISOString(),
    };
    if (!dryRun) {
      lastRun = Date.now();
      lastResult = body;
    }
    return NextResponse.json(body);
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message || 'Error desconocido' }, { status: 500 });
  } finally {
    running = false;
  }
}
