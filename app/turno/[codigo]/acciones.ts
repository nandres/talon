'use server';

import { redirect } from 'next/navigation';
import { clienteAdmin } from '@/lib/supabase/admin';
import { pasarelaSimulada } from '@/lib/pagos/pasarela';

const CODIGO = /^[0-9A-F]{8}$/i;

export async function pagarSena(_: unknown, form: FormData): Promise<{ error: string }> {
  const codigo = String(form.get('codigo') ?? '');
  if (!CODIGO.test(codigo)) return { error: 'Código de turno inválido.' };
  const { data, error } = await clienteAdmin().rpc('abrir_cobro', { p_codigo: codigo, p_proveedor: pasarelaSimulada.nombre });
  if (error || !data?.[0]) {
    return { error: error?.code === 'TAL06' ? 'Este turno ya no espera un pago: puede que haya vencido el plazo.' : 'No pudimos abrir el pago. Probá de nuevo.' };
  }
  redirect(pasarelaSimulada.urlDePago(data[0].referencia));
}
