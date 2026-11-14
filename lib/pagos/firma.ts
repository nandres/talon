// Firma de los avisos de pago: HMAC-SHA256 sobre "marca_de_tiempo.cuerpo", como hacen
// Stripe y la mayoría de las pasarelas. La marca de tiempo impide reenviar un aviso viejo.

import { createHmac, timingSafeEqual } from 'node:crypto';

export const TOLERANCIA_SEG = 300;

export function firmar(cuerpo: string, secreto: string, marca = Math.floor(Date.now() / 1000)): string {
  const hmac = createHmac('sha256', secreto).update(`${marca}.${cuerpo}`).digest('hex');
  return `t=${marca},v1=${hmac}`;
}

export type Verificacion = { ok: true } | { ok: false; motivo: 'formato' | 'vencida' | 'firma' };

export function verificar(cuerpo: string, cabecera: string | null, secreto: string, ahora = Math.floor(Date.now() / 1000)): Verificacion {
  const partes = Object.fromEntries((cabecera ?? '').split(',').map(p => p.split('=') as [string, string]));
  const marca = Number(partes.t);
  if (!partes.t || !partes.v1 || !Number.isInteger(marca) || !/^[0-9a-f]{64}$/.test(partes.v1)) return { ok: false, motivo: 'formato' };
  if (Math.abs(ahora - marca) > TOLERANCIA_SEG) return { ok: false, motivo: 'vencida' };
  const esperada = Buffer.from(createHmac('sha256', secreto).update(`${marca}.${cuerpo}`).digest('hex'));
  const recibida = Buffer.from(partes.v1);
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida) ? { ok: true } : { ok: false, motivo: 'firma' };
}
