# Método Orense de Scouting — versión con Supabase + GitHub + Vercel

Esta es la misma app de scouting (login obligatorio, informes N1 a N5,
tablero por jugador con gráficos de araña), pero ahora con un backend real:

- **Supabase**: base de datos compartida (todos los observadores ven los
  mismos informes) y autenticación (nadie entra sin su usuario y clave).
- **GitHub**: guarda el código.
- **Vercel**: aloja la app y le da un enlace público.

No incluye todavía el **PDF descargable** ni el **informe completo** de la
versión de un solo archivo — la maqueta y el flujo de datos están listos
para agregarlos después (ver "Qué falta" al final).

## 1. Crear el proyecto en Supabase

1. Entra a [supabase.com](https://supabase.com) → **New project**. Elige
   nombre, contraseña de la base de datos y región (la más cercana a Ecuador).
2. Cuando el proyecto esté listo, ve a **SQL Editor** → **New query**, pega
   todo el contenido de [`supabase/schema.sql`](./supabase/schema.sql) y
   dale **Run**. Esto crea la tabla de informes, la vista de jugadores, las
   reglas de seguridad (RLS) y los buckets de fotos y adjuntos.
3. Ve a **Settings → API** y copia dos valores: **Project URL** y
   **anon public key**. Los necesitas en el paso 3.
4. Crea las cuentas de los observadores: **Authentication → Users → Add
   user**, una por cada persona (correo + contraseña provisional). No hay
   pantalla de "crear cuenta" en la app — las cuentas las da la Secretaría
   Técnica.

## 2. Subir el código a GitHub

```bash
cd orense-app
git init
git add .
git commit -m "Método Orense de Scouting"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```

(Si prefieres, crea el repositorio primero en github.com y sigue las
instrucciones que GitHub te muestra ahí — el resultado es el mismo.)

## 3. Desplegar en Vercel

1. En [vercel.com](https://vercel.com) → **Add New → Project** → elige el
   repositorio que acabas de subir.
2. En **Environment Variables**, agrega las dos que copiaste de Supabase:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. **Deploy**. En un par de minutos tendrás un enlace público
   (`algo.vercel.app`). Cada vez que subas cambios a `main` en GitHub,
   Vercel vuelve a publicar solo.

## 4. Probarla

Abre el enlace de Vercel: lo primero que aparece es la pantalla de inicio
de sesión. Entra con uno de los correos que creaste en el paso 1.4. Nadie
puede ver ni un dato sin entrar antes — eso lo hace `middleware.ts`.

## Desarrollo local (opcional)

```bash
cp .env.example .env.local   # y pega tu URL y anon key
npm install
npm run dev                  # http://localhost:3000
```

## Cómo está organizado el código

- `lib/formModel.ts` — el motor: niveles N1–N5, secciones, campos y
  escalas del Método Orense de Scouting. Es la misma definición que ya se
  usó y probó en la versión de un solo archivo.
- `lib/reports.ts` — toda la comunicación con Supabase (leer, crear,
  editar, borrar informes; subir fotos y adjuntos).
- `middleware.ts` — el candado: sin sesión de Supabase, no se ve nada.
- `app/login` — pantalla de inicio de sesión.
- `app/page.tsx` + `components/PlayersList.tsx` — lista de jugadores.
- `app/reports/new`, `app/reports/[id]/edit` + `components/DynamicForm.tsx`
  y `components/FieldRenderer.tsx` — el formulario completo.
- `app/players/[key]` + `components/PlayerDashboardClient.tsx` +
  `components/RadarChart.tsx` — el tablero de cada jugador.

## Quién puede editar qué

Por defecto, **cualquier observador conectado puede ver y editar todos los
informes** (política pensada para un equipo pequeño que comparte el
trabajo). Si prefieres que cada quien solo pueda editar los suyos, cambia
las políticas `update`/`delete` en `supabase/schema.sql` para exigir
`created_by = auth.uid()`, y vuelve a ejecutarlas en el SQL Editor.

## Qué falta (siguiente fase)

Esta versión cubre el circuito completo (login → crear informe → verlo en
el tablero de su jugador, con gráficos de araña), pero todavía no tiene:

- **Descarga en PDF** del informe completo y del tablero (en la versión de
  un solo archivo sí existe, con jsPDF; se puede portar reusando la misma
  lógica de dibujo).
- **Vista de "informe completo"** de un jugador (todos sus informes en un
  solo documento en pantalla, sin repetir los datos base).
- **Exportar/importar CSV o JSON.**
- Subida de **adjuntos** en los informes N4 y N5 (el bucket ya existe en
  Supabase; falta el botón en el formulario).
- Un buscador de jugadores ya observados **dentro** del campo "Nombre"
  (autocompletar), como en la versión de un solo archivo.

Todo esto reutiliza piezas que ya están en el proyecto (el mismo
`lib/formModel.ts`, el mismo estilo de PDF), así que se puede agregar por
partes sin rehacer lo ya construido.
