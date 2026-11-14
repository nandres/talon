// Webhook de la pasarela: verifica la firma, registra el evento una sola vez y confirma el turno.

import { NextResponse } from 'next/server';
import { clienteAdmin } from '@/lib/supabase/admin';
import { verificar } from '@/lib/pagos/firma';
import { pasarelaSimulada, secretoPagos, type EventoPago } from '@/lib/pagos/pasarela';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const cuerpo = await request.text();
  if (cuerpo.length > 10_000) return NextResponse.json({ error: 'cuerpo demasiado grande' }, { status: 413 });

  const firma = verificar(cuerpo, request.headers.get('x-talon-firma'), secretoPagos());
  if (!firma.ok) return NextResponse.json({ error: `firma inválida (${firma.motivo})` }, { status: 401 });

  let evento: EventoPago;
  try {
    evento = JSON.parse(cuerpo);
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }
  if (typeof evento.id !== 'string' || typeof evento.referencia !== 'string' || !Number.isInteger(evento.monto_gs)
      || !['pago.aprobado', 'pago.rechazado'].includes(evento.tipo)) {
    return NextResponse.json({ error: 'evento incompleto' }, { status: 400 });
  }

  const { data, error } = await clienteAdmin().rpc('registrar_aviso_pago', {
    p_evento: evento.id, p_proveedor: pasarelaSimulada.nombre, p_referencia: evento.referencia, p_tipo: evento.tipo, p_monto: evento.monto_gs,
  });
  if (error) {
    // 4xx: la pasarela no debe reintentar un aviso que nunca va a cuadrar.
    const definitivo = error.code === 'TAL01' || error.code === 'TAL07';
    return NextResponse.json({ error: 'no se pudo registrar' }, { status: definitivo ? 422 : 500 });
  }
  return NextResponse.json({ resultado: data });
}
