'use client';

import { useActionState, useState, useTransition } from 'react';
import { entrar, entrarDemo } from './acciones';

const CUENTAS = [
  { id: 'la-navaja', titulo: 'Barbería La Navaja', detalle: 'Ramón, dueño' },
  { id: 'la-navaja-personal', titulo: 'Barbería La Navaja', detalle: 'Tati, del equipo (sin catálogo)' },
  { id: 'kine-mburucuya', titulo: 'Kine Mburucuyá', detalle: 'Paula, dueña' },
];

export default function Formulario() {
  const [estado, enviar, enviando] = useActionState(entrar, null);
  const [errorDemo, setErrorDemo] = useState<string | null>(null);
  const [entrando, iniciar] = useTransition();
  const [cual, setCual] = useState<string | null>(null);

  return (
    <div className="vidrio vidrio-oscuro p-5">
      <p className="etq">Entrar como</p>
      <div className="mt-3 grid gap-2">
        {CUENTAS.map(c => (
          <button key={c.id} type="button" disabled={entrando}
            onClick={() => { setCual(c.id); setErrorDemo(null); iniciar(async () => { const r = await entrarDemo(c.id); if (r?.error) setErrorDemo(r.error); }); }}
            className="group flex items-center justify-between rounded-[14px] px-4 py-3 text-left transition-colors disabled:opacity-60"
            style={{ background: 'rgb(var(--vidrio) / .1)', boxShadow: 'inset 0 0 0 1px var(--linea)' }}>
            <span>
              <span className="block font-medium">{c.titulo}</span>
              <span className="block text-[.88rem] text-[color:var(--texto-2)]">{c.detalle}</span>
            </span>
            <span aria-hidden className="text-[color:var(--acento)] transition-transform group-hover:translate-x-1">{entrando && cual === c.id ? '…' : '→'}</span>
          </button>
        ))}
      </div>
      {errorDemo && <p role="alert" className="mt-3 text-[.92rem] text-[color:var(--aviso)]">{errorDemo}</p>}

      <div className="filete my-5" />
      <form action={enviar} className="grid gap-3">
        <p className="etq">O con tu cuenta</p>
        <label className="sr-only" htmlFor="correo">Correo</label>
        <input id="correo" name="correo" type="email" autoComplete="email" required className="campo" placeholder="Correo" />
        <label className="sr-only" htmlFor="clave">Contraseña</label>
        <input id="clave" name="clave" type="password" autoComplete="current-password" required className="campo" placeholder="Contraseña" />
        {estado?.error && <p role="alert" className="text-[.92rem] text-[color:var(--aviso)]">{estado.error}</p>}
        <button type="submit" disabled={enviando} className="mt-1 rounded-[14px] py-3 font-semibold disabled:opacity-50" style={{ background: 'var(--acento)', color: 'var(--acento-tinta)' }}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </div>
  );
}
