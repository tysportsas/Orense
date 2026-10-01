// app/api/photo-proxy/route.ts
//
// Proxy server-side para imágenes de jugadores guardadas en Supabase Storage.
// El cliente pasa la ruta (path) del archivo en el bucket "player-photos"
// y este endpoint devuelve la imagen como base64 data URL.
//
// Esto evita completamente los bloqueos de CORS que html2canvas sufre al
// intentar renderizar imágenes externas en el PDF generado en el cliente.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const path = req.nextUrl.searchParams.get('path');
  const urlParam = req.nextUrl.searchParams.get('url');

  let imageUrl: string | null = null;

  if (path) {
    // Ruta interna del bucket → generar URL firmada server-side (1 hora)
    const supabase = createClient();
    const { data, error } = await supabase.storage
      .from('player-photos')
      .createSignedUrl(path, 3600);

    if (error || !data?.signedUrl) {
      return NextResponse.json({ error: 'No se pudo generar la URL firmada' }, { status: 404 });
    }
    imageUrl = data.signedUrl;
  } else if (urlParam) {
    // URL externa directa (foto_url)
    imageUrl = urlParam;
  }

  if (!imageUrl) {
    return NextResponse.json({ error: 'Se requiere path o url' }, { status: 400 });
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      return NextResponse.json(
        { error: `Error al obtener la imagen: HTTP ${response.status}` },
        { status: response.status }
      );
    }

    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const base64 = Buffer.from(buffer).toString('base64');
    const dataUrl = `data:${contentType};base64,${base64}`;

    return NextResponse.json({ dataUrl });
  } catch (err) {
    console.error('[photo-proxy] Error:', err);
    return NextResponse.json({ error: 'Error al descargar la imagen' }, { status: 500 });
  }
}
