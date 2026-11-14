import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Zodiak y Switzer (Indian Type Foundry, licencia gratuita de Fontshare), alojadas en el proyecto.
// Zodiak: serifa de alto contraste para el rótulo pintado en el vidrio y los números.
// Switzer: grotesca sobria para toda la interfaz.
const zodiak = localFont({
  variable: '--f-rotulo',
  display: 'swap',
  src: [
    { path: './fuentes/zodiak-400.woff2', weight: '400', style: 'normal' },
    { path: './fuentes/zodiak-400i.woff2', weight: '400', style: 'italic' },
    { path: './fuentes/zodiak-700.woff2', weight: '700', style: 'normal' },
    { path: './fuentes/zodiak-700i.woff2', weight: '700', style: 'italic' },
  ],
});

const switzer = localFont({
  variable: '--f-ui',
  display: 'swap',
  src: [
    { path: './fuentes/switzer-400.woff2', weight: '400' },
    { path: './fuentes/switzer-500.woff2', weight: '500' },
    { path: './fuentes/switzer-600.woff2', weight: '600' },
  ],
});

export const metadata: Metadata = {
  title: { default: 'Talón — turnos para negocios', template: '%s · Talón' },
  description: 'Reservá tu turno en línea: elegí servicio, profesional y horario, y llevate tu número.',
};

export const viewport: Viewport = { themeColor: '#1c120c' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-PY" className={`${zodiak.variable} ${switzer.variable}`}>
      <body>{children}</body>
    </html>
  );
}
