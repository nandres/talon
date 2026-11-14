'use client';

import { useState, useTransition } from 'react';
import { enviarAhora } from './acciones';

export default function EnviarAhora({ slug, pendientes }: { slug: string; pendientes: number }) {
  const [texto, setTexto] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  return (
    <div className="mt-5">
      <button type="button" disabled={enviando || !pendientes} onClick={() => iniciar(async () => setTexto((await enviarAhora(slug)).texto))}
        className="w-full rounded-[14px] py-2.5 text-[.95rem] font-semibold disabled:opacity-45" style={{ background: 'var(--acento)', color: 'var(--acento-tinta)' }}>
        {enviando ? 'Mandando…' : `Mandar los que tocan (${pendientes})`}
      </button>
      {texto && <p role="status" className="mt-2 text-[.88rem] text-[color:var(--texto-2)]">{texto}</p>}
    </div>
  );
}
