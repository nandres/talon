'use client';

import { useActionState } from 'react';
import { motion } from 'motion/react';
import { guaranies } from '@/lib/formato';
import { pagarSena } from './acciones';

export default function BotonPagar({ codigo, montoGs }: { codigo: string; montoGs: number }) {
  const [estado, accion, pendiente] = useActionState(pagarSena, null);
  return (
    <form action={accion} className="mt-5">
      <input type="hidden" name="codigo" value={codigo} />
      <motion.button type="submit" disabled={pendiente} whileHover={{ y: -1 }} whileTap={{ scale: 0.98 }}
        className="rounded-[14px] px-6 py-3.5 text-[1.02rem] font-semibold disabled:opacity-50" style={{ background: 'var(--acento)', color: 'var(--acento-tinta)' }}>
        {pendiente ? 'Abriendo el pago…' : `Pagar la seña · ${guaranies(montoGs)}`}
      </motion.button>
      {estado?.error && <p role="alert" className="mt-3 text-[.92rem] text-[color:var(--aviso)]">{estado.error}</p>}
    </form>
  );
}
