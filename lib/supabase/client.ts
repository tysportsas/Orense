// lib/supabase/client.ts
//
// Cliente de Supabase para usar dentro de Client Components (formularios,
// botones de guardar, subida de fotos...). Lee la URL y la clave pública
// (anon key) de las variables de entorno — nunca la service_role key aquí.

'use client';

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
