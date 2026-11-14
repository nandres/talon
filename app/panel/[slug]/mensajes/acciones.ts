'use server';

import { revalidatePath } from 'next/cache';
import { sesionActual } from '@/lib/supabase/servidor';
import { clienteAdmin } from '@/lib/supabase/admin';
import { procesarCola } from '@/lib/mensajes/enviar';

/** Manda ya los mensajes de este negocio que tocan (en producción lo hace el proceso programado). */
export async function enviarAhora(slug: string): Promise<{ texto: string }> {
  const sesion = await sesionActual();
  const m = sesion?.membresias.find(x => x.negocios.slug === slug);
  if (!m) return { texto: 'Tu sesión venció. Volvé a entrar.' };
  const r = await procesarCola(clienteAdmin(), { negocioId: m.negocio_id, limite: 200 });
  revalidatePath(`/panel/${slug}/mensajes`);
  return { texto: r.tomados ? `Salieron ${r.enviados} mensajes${r.fallidos ? `, ${r.fallidos} fallaron` : ''}.` : 'No había mensajes para mandar todavía.' };
}
