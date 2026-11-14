// Envío de los mensajes en cola. El canal real (WhatsApp Cloud API, un proveedor de SMS o
// correo) se enchufa implementando Canal; la demo usa uno simulado que no sale a internet.

import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type Mensaje = { id: string; canal: 'whatsapp' | 'correo'; destino: string; cuerpo: string; intentos: number };

export interface Canal {
  nombre: string;
  enviar(m: Mensaje): Promise<{ ok: true } | { ok: false; error: string }>;
}

export const canalSimulado: Canal = {
  nombre: 'simulado',
  async enviar() {
    return { ok: true };
  },
};

const MAX_INTENTOS = 3;

export async function procesarCola(db: SupabaseClient, { negocioId = null, limite = 100, canal = canalSimulado }: { negocioId?: string | null; limite?: number; canal?: Canal } = {}) {
  const { data, error } = await db.rpc('tomar_mensajes', { p_limite: limite, p_negocio: negocioId });
  if (error) throw new Error(`No se pudo leer la cola: ${error.message}`);
  const tomados = (data ?? []) as Mensaje[];

  let enviados = 0, fallidos = 0, reintentos = 0;
  for (const m of tomados) {
    const r = await canal.enviar(m).catch((e: unknown) => ({ ok: false as const, error: String(e) }));
    if (r.ok) {
      await db.from('mensajes').update({ estado: 'enviado', enviado_en: new Date().toISOString(), tomado_en: null }).eq('id', m.id);
      enviados++;
    } else if (m.intentos >= MAX_INTENTOS) {
      await db.from('mensajes').update({ estado: 'fallido', tomado_en: null }).eq('id', m.id);
      fallidos++;
    } else {
      // Vuelve a la cola con espera creciente: 5, 10, 20 minutos.
      const espera = 5 * 2 ** (m.intentos - 1);
      await db.from('mensajes').update({ estado: 'en_cola', tomado_en: null, programado_para: new Date(Date.now() + espera * 60_000).toISOString() }).eq('id', m.id);
      reintentos++;
    }
  }
  return { tomados: tomados.length, enviados, fallidos, reintentos };
}
