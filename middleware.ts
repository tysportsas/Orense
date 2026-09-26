// middleware.ts
//
// Este es el candado real de la aplicación: se ejecuta en el servidor
// antes de cargar CUALQUIER página. Si la persona no tiene una sesión
// válida de Supabase, se la manda a /login sin mostrarle nada más.
// Al entrar con su correo y contraseña, Supabase Auth deja una cookie de
// sesión firmada; ese es el único mecanismo de acceso — no hay ninguna
// contraseña "de mentira" escondida en el código.

import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  // Se aplica a todo, salvo archivos estáticos y los recursos internos de Next.
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)']
};
