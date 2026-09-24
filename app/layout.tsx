import type { Metadata } from 'next';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'Método Orense de Scouting',
  description: 'Secretaría Técnica, Orense SC — informes de observación de jugadores'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-bg text-ink font-sans">{children}</body>
    </html>
  );
}
