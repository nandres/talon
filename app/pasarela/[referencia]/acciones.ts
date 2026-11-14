'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { clienteAdmin } from '@/lib/supabase/admin';
import { avisarComoPasarela } from '@/lib/pagos/pasarela';

// Esto simula el servidor de la pasarela: el comercio solo se entera por el webhook firmado.
export async function resolverPago(form: FormData) {
  const referencia = String(form.get('referencia') ?? '');
  const aprobado = form.get('resultado') === 'aprobar';
  const { data: pago } = await clienteAdmin().from('pagos').select('monto_gs, estado, reservas(codigo)').eq('referencia', referencia).maybeSingle();
  if (!pago) redirect('/');
  const codigo = (pago.reservas as unknown as { codigo: string }).codigo;

  if (pago.estado === 'pendiente') {
    const h = await headers();
    const origen = `${h.get('x-forwarded-proto') ?? 'http'}://${h.get('host')}`;
    await avisarComoPasarela(origen, referencia, Number(pago.monto_gs), aprobado);
  }
  redirect(`/turno/${codigo}?pago=${aprobado ? 'aprobado' : 'rechazado'}`);
}
