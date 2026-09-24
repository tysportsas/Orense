// lib/supabase/server.ts
//
// Cliente de Supabase para Server Components y Route Handlers. Lee y
// escribe la sesión a través de las cookies de la petición, para que el
// servidor sepa qué observador está conectado sin exponer ninguna clave
// secreta al navegador.

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Se puede llamar desde un Server Component de solo lectura;
            // el middleware es quien realmente persiste la sesión.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {}
        }
      }
    }
  );
}
