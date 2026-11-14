// Proceso programado: libera señas vencidas y manda los mensajes que ya tocan.
// Vercel Cron lo llama con "Authorization: Bearer <CRON_SECRET>".

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { clienteAdmin } from '@/lib/supabase/admin';
import { procesarCola } from '@/lib/mensajes/enviar';

export const dynamic = 'force-dynamic';

function autorizado(cabecera: string | null): boolean {
  const secreto = process.env.CRON_SECRET;
  if (!secreto || !cabecera) return false;
  const a = Buffer.from(cabecera), b = Buffer.from(`Bearer ${secreto}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!autorizado(request.headers.get('authorization'))) return NextResponse.json({ error: 'no autorizado' }, { status: 401 });
  const db = clienteAdmin();
  const { data: liberadas } = await db.rpc('liberar_vencidas');
  const cola = await procesarCola(db, { limite: 300 });
  return NextResponse.json({ liberadas, ...cola });
}
