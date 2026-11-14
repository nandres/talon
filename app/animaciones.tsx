'use client';

import { motion, useReducedMotion } from 'motion/react';
import type { ReactNode } from 'react';

export const SUAVE = [0.22, 1, 0.36, 1] as const;

// El estado inicial es siempre el mismo (lo dibuja el servidor); con "reducir movimiento"
// solo cambia la duración a cero. Si cambiara el inicial, la hidratación no coincidiría.

/** Entra subiendo apenas y desempañándose. `i` escalona la entrada. */
export function Aparecer({ i = 0, children, className }: { i?: number; children: ReactNode; className?: string }) {
  const quieto = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={quieto ? { duration: 0 } : { duration: 0.7, delay: 0.08 * i, ease: SUAVE }}
    >
      {children}
    </motion.div>
  );
}

/** El rótulo se pinta de izquierda a derecha, como el letrista sobre el vidrio. */
export function Pintar({ as = 'h1', children, className }: { as?: 'h1' | 'p'; children: ReactNode; className?: string }) {
  const quieto = useReducedMotion();
  const Etiqueta = as === 'h1' ? motion.h1 : motion.p;
  return (
    <Etiqueta
      className={className}
      initial={{ clipPath: 'inset(-10% 100% -10% 0)' }}
      animate={{ clipPath: 'inset(-10% 0% -10% 0)' }}
      transition={quieto ? { duration: 0 } : { duration: 1.6, ease: [0.65, 0, 0.35, 1], delay: 0.2 }}
    >
      {children}
    </Etiqueta>
  );
}
