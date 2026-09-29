# Método Orense de Scouting

Aplicación Next.js para gestionar informes de scouting, jugadores, dashboard y campograma. Supabase provee autenticación, base de datos compartida y almacenamiento.

## Supabase

1. En un proyecto Supabase, abre **SQL Editor** y ejecuta `supabase/schema.sql`. El script crea o actualiza la tabla, la vista segura, el RPC de consulta por jugador, los índices y las políticas RLS/Storage.
2. En **Settings → API**, copia **Project URL** y **anon public key**.
3. En **Authentication → Users**, crea las cuentas autorizadas. No hay registro público.
4. En cada usuario, asigna `role` en **App Metadata**, nunca en User Metadata. Valores admitidos:
   - `admin`: acceso completo, importación y borrado.
   - `scout`: consulta, creación y edición de informes; acceso a dashboard y campograma.
   - `viewer`: solo lectura de jugadores, informes, dashboard y campograma.

Si el rol no existe o no es válido, el sistema aplica `viewer`. Asigna el primer `admin` desde Supabase antes de entrar en `/admin`. Para usuarios existentes, migra el rol de User Metadata a App Metadata y elimina el campo antiguo. Los cambios de rol requieren iniciar sesión de nuevo para renovar el token.

## Variables de entorno

Copia `.env.example` a `.env.local` y configura:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
```

En Vercel, define las mismas variables en **Settings → Environment Variables**. La anon key es pública; la autorización efectiva está en middleware y RLS. No configures una service-role key en el navegador.

## Desarrollo

```bash
npm install
npm run dev
```

Abre `http://localhost:3000`.

## Autorización

El inicio de sesión usa Supabase Auth. Middleware verifica la sesión y el rol de `app_metadata` antes de servir páginas o APIs. Las políticas RLS vuelven a aplicar permisos en la base de datos: todos los usuarios autenticados pueden leer; `admin` y `scout` pueden crear/editar; solo `admin` puede borrar. Storage sigue el mismo criterio de lectura/escritura.

La importación por URL acepta exclusivamente enlaces de Google Sheets y requiere sesión administrativa. La consulta de informes de un jugador usa `reports_for_player`; la vista `players_view` resume informes para evitar descargar todo el conjunto al formulario.

## Estructura

- `lib/formModel.ts`: niveles N1–N5, secciones, campos y escalas.
- `lib/reports.ts`: consultas de informes, jugadores, fotos y adjuntos.
- `middleware.ts`: refresco de sesión y control de rutas por rol.
- `supabase/schema.sql`: estructura de datos, índices, funciones, vista y políticas.
- `app/` y `components/`: páginas y experiencia de scouting.

## Funcionalidades pendientes

- Descarga de informes y dashboard en PDF.
- Vista consolidada de todos los informes de un jugador.
- Subida de adjuntos N4/N5 desde el formulario.
- Autocompletado de jugadores en el campo Nombre.
