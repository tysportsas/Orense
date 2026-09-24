import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const url = body.url;
    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'URL no válida' }, { status: 400 });
    }

    let targetUrl = url.trim();

    // Si es un enlace de Google Sheets, convertir a enlace de descarga CSV
    const match = targetUrl.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match) {
      const sheetId = match[1];
      let gid = '';
      const gidMatch = targetUrl.match(/[?&#]gid=([0-9]+)/);
      if (gidMatch) {
        gid = `&gid=${gidMatch[1]}`;
      }
      targetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid}`;
    }

    const res = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (!res.ok) {
      return NextResponse.json(
        {
          error: `No se pudo obtener el archivo desde el enlace. (Código HTTP: ${res.status}). Asegúrate de que el documento de Google Sheets tenga activada la opción de acceso público: "Cualquier persona con el enlace puede ver".`
        },
        { status: 400 }
      );
    }

    const text = await res.text();
    return NextResponse.json({ content: text, targetUrl });
  } catch (err: any) {
    return NextResponse.json({ error: 'Error al conectar con la URL: ' + err.message }, { status: 500 });
  }
}
