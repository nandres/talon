// Adaptador de pasarela de pagos. La demo usa una pasarela simulada que se comporta como
// una real: crea el cobro, manda al cliente a una página de pago y avisa el resultado con un
// POST firmado al webhook. Para Pagopar o Bancard alcanza con otra implementación de Pasarela.

import 'server-only';
import { randomUUID } from 'node:crypto';
import { firmar } from './firma';

export type EventoPago = {
  id: string;
  tipo: 'pago.aprobado' | 'pago.rechazado';
  referencia: string;
  monto_gs: number;
  fecha: string;
};

export interface Pasarela {
  nombre: string;
  /** Devuelve la URL a la que se manda al cliente para pagar. */
  urlDePago(referencia: string): string;
}

export function secretoPagos(): string {
  const s = process.env.PAGOS_SECRETO;
  if (s) return s;
  if (process.env.NODE_ENV === 'production') throw new Error('Falta PAGOS_SECRETO.');
  return 'secreto-local-solo-para-desarrollo';
}

export const pasarelaSimulada: Pasarela = {
  nombre: 'simulada',
  urlDePago: referencia => `/pasarela/${encodeURIComponent(referencia)}`,
};

/** Lo que haría el servidor de la pasarela: avisar al comercio con un POST firmado. */
export async function avisarComoPasarela(origen: string, referencia: string, montoGs: number, aprobado: boolean) {
  const evento: EventoPago = {
    id: `evt_${randomUUID()}`,
    tipo: aprobado ? 'pago.aprobado' : 'pago.rechazado',
    referencia,
    monto_gs: montoGs,
    fecha: new Date().toISOString(),
  };
  const cuerpo = JSON.stringify(evento);
  const r = await fetch(`${origen}/api/pagos/aviso`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-talon-firma': firmar(cuerpo, secretoPagos()) },
    body: cuerpo,
    cache: 'no-store',
  });
  return { ok: r.ok, estado: r.status, resultado: (await r.json().catch(() => null)) as { resultado?: string } | null };
}
