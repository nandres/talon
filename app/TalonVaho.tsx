'use client';

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { SUAVE } from './animaciones';

/** El número escrito con el dedo en el vidrio empañado. Lo usan la reserva y la consulta del turno. */
export default function TalonVaho({ numero, enfocar = true, children }: { numero: string; enfocar?: boolean; children: ReactNode }) {
  const quieto = useReducedMotion();
  const ref = useRef<HTMLElement>(null);
  const gotas = useMemo(() => Array.from({ length: 10 }, (_, i) => ({ left: `${6 + i * 9.5}%`, top: `${(i * 37) % 55}%`, t: `${5 + (i % 4) * 1.6}s`, d: `${i * 0.7}s` })), []);
  useEffect(() => {
    if (!enfocar) return;
    ref.current?.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'center' });
    ref.current?.focus({ preventScroll: true });
  }, [quieto, enfocar]);

  return (
    <motion.section ref={ref} tabIndex={-1} aria-live="polite" className="vidrio vaho mx-auto grid min-h-[28rem] max-w-2xl place-items-center p-8 text-center outline-none"
      initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, ease: SUAVE }}>
      {gotas.map((g, i) => <span key={i} className="gota" style={{ left: g.left, top: g.top, ['--t' as string]: g.t, ['--d' as string]: g.d }} />)}
      <div className="relative">
        <p className="etq">Tu número</p>
        <motion.p className="limpio mt-2 text-[clamp(7rem,22vw,12rem)] leading-[.85]" aria-label={`Número ${numero}`}
          initial={{ clipPath: 'inset(0 100% 0 0 round 40px)' }} animate={{ clipPath: 'inset(0 0% 0 0 round 40px)' }}
          transition={quieto ? { duration: 0 } : { duration: 1.4, delay: 0.5, ease: [0.6, 0, 0.3, 1] }}>
          {numero}
        </motion.p>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={quieto ? { duration: 0 } : { delay: 1.7, duration: 0.6, ease: SUAVE }}>
          {children}
        </motion.div>
      </div>
    </motion.section>
  );
}
