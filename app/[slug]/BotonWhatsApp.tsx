'use client';

import { useEffect, useState } from 'react';

const CLASES = 'vidrio rounded-full px-4 py-2 text-[.85rem] font-medium';
const REDONDO = { borderRadius: 999 };

/** Botón de WhatsApp del negocio. En la demo no enlaza a nada: avisa que el número es ficticio. */
export default function BotonWhatsApp({ telefono, demo }: { telefono: string; demo: boolean }) {
  const [aviso, setAviso] = useState(false);
  useEffect(() => {
    if (!aviso) return;
    const t = setTimeout(() => setAviso(false), 3500);
    return () => clearTimeout(t);
  }, [aviso]);

  if (!demo) {
    return <a href={`https://wa.me/${telefono.replace(/\D/g, '')}`} className={CLASES} style={REDONDO}>Escribir por WhatsApp</a>;
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setAviso(true)} className={CLASES} style={REDONDO} aria-describedby="aviso-demo">
        Escribir por WhatsApp
      </button>
      <p id="aviso-demo" role="status"
        className={`vidrio absolute right-0 top-[calc(100%+.5rem)] z-10 w-max max-w-[16rem] px-3.5 py-2 text-[.8rem] leading-snug transition-opacity duration-300 ${aviso ? 'opacity-100' : 'pointer-events-none opacity-0'}`}>
        {aviso ? 'Es un negocio de ejemplo: este botón no escribe a nadie.' : ''}
      </p>
    </div>
  );
}
