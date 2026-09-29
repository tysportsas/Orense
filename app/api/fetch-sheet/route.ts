import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MAX_CSV_BYTES = 5 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const GOOGLE_HOSTS = new Set(['docs.google.com', 'drive.google.com']);

function isAllowedGoogleUrl(url: URL): boolean {
  return (
    url.protocol === 'https:' &&
    !url.username &&
    !url.password &&
    !url.port &&
    (GOOGLE_HOSTS.has(url.hostname) || url.hostname.endsWith('.googleusercontent.com'))
  );
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Debes iniciar sesión para importar.' }, { status: 401 });
    }

    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > 2048) {
      return NextResponse.json({ error: 'La solicitud es demasiado grande.' }, { status: 413 });
    }

    let body: { url?: unknown };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Solicitud JSON no válida.' }, { status: 400 });
    }

    if (typeof body.url !== 'string') {
      return NextResponse.json({ error: 'URL no válida' }, { status: 400 });
    }

    let sourceUrl: URL;
    try {
      sourceUrl = new URL(body.url.trim());
    } catch {
      return NextResponse.json({ error: 'URL no válida.' }, { status: 400 });
    }

    const sheetMatch = sourceUrl.pathname.match(/^\/spreadsheets\/d\/([a-zA-Z0-9_-]+)(?:\/(?:edit|view))?\/?$/);
    if (!isAllowedGoogleUrl(sourceUrl) || sourceUrl.hostname !== 'docs.google.com' || !sheetMatch) {
      return NextResponse.json({ error: 'Usa un enlace válido de Google Sheets.' }, { status: 400 });
    }

    const targetUrl = new URL(`https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/export`);
    targetUrl.searchParams.set('format', 'csv');
    const gid = sourceUrl.searchParams.get('gid');
    if (gid && /^\d+$/.test(gid)) targetUrl.searchParams.set('gid', gid);

    let currentUrl = targetUrl;
    let res: Response;
    for (let redirectCount = 0; ; redirectCount++) {
      res = await fetch(currentUrl, {
        headers: { 'User-Agent': 'Orense-Scouting/1.0' },
        redirect: 'manual',
        signal: AbortSignal.timeout(12_000)
      });

      if (res.status < 300 || res.status >= 400) break;
      const location = res.headers.get('location');
      if (!location || redirectCount >= MAX_REDIRECTS) {
        return NextResponse.json({ error: 'Google Sheets respondió con una redirección no válida.' }, { status: 502 });
      }

      const nextUrl = new URL(location, currentUrl);
      if (!isAllowedGoogleUrl(nextUrl)) {
        return NextResponse.json({ error: 'La redirección apunta a un destino no permitido.' }, { status: 400 });
      }
      currentUrl = nextUrl;
    }

    if (!res.ok) {
      return NextResponse.json(
        {
          error: `No se pudo obtener la hoja (HTTP ${res.status}). Verifica que sea accesible con el enlace.`
        },
        { status: 400 }
      );
    }

    const responseLength = Number(res.headers.get('content-length') || 0);
    if (responseLength > MAX_CSV_BYTES || !res.body) {
      return NextResponse.json({ error: 'La hoja está vacía o supera el límite de 5 MB.' }, { status: 413 });
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let content = '';
    let bytesRead = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_CSV_BYTES) {
        await reader.cancel();
        return NextResponse.json({ error: 'La hoja supera el límite de 5 MB.' }, { status: 413 });
      }
      content += decoder.decode(value, { stream: true });
    }
    content += decoder.decode();

    return NextResponse.json({ content, targetUrl: currentUrl.toString() });
  } catch {
    return NextResponse.json({ error: 'No se pudo conectar con Google Sheets dentro del tiempo permitido.' }, { status: 502 });
  }
}
