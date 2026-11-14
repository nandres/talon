import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { clienteAdmin } from '@/lib/supabase/admin';
import { guaranies } from '@/lib/formato';
import { resolverPago } from './acciones';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Pasarela de prueba', robots: { index: false } };

// Página de la pasarela simulada. A propósito no se parece a Talón: en la vida real es otro sitio.
// No pide datos de tarjeta: solo deja elegir el resultado para probar el circuito completo.
export default async function Pasarela({ params }: { params: Promise<{ referencia: string }> }) {
  const { referencia } = await params;
  const { data: pago } = await clienteAdmin()
    .from('pagos').select('referencia, monto_gs, estado, negocios(nombre), reservas(servicios(nombre))')
    .eq('referencia', decodeURIComponent(referencia)).maybeSingle();
  if (!pago) notFound();
  const negocio = (pago.negocios as unknown as { nombre: string }).nombre;
  const servicio = (pago.reservas as unknown as { servicios: { nombre: string } }).servicios.nombre;

  return (
    <div className="min-h-dvh bg-[#eef0f3] px-4 py-10 font-ui text-[#16181d]" style={{ colorScheme: 'light' }}>
      <div className="mx-auto max-w-md">
        <p className="rounded-lg bg-[#fff4d6] px-4 py-2.5 text-[.88rem] text-[#5c4300]">
          Pasarela <strong>de prueba</strong>: no se cobra dinero real ni se piden datos de tarjeta.
        </p>
        <div className="mt-4 rounded-2xl bg-white p-6 shadow-[0_1px_2px_rgb(0_0_0/.06),0_12px_32px_-12px_rgb(0_0_0/.18)]">
          <p className="text-[.8rem] font-semibold uppercase tracking-[.14em] text-[#6b7280]">Pago a</p>
          <p className="mt-1 text-[1.25rem] font-semibold">{negocio}</p>
          <p className="text-[.95rem] text-[#6b7280]">Seña · {servicio}</p>
          <p className="mt-6 text-[.8rem] font-semibold uppercase tracking-[.14em] text-[#6b7280]">Monto</p>
          <p className="text-[2.2rem] font-semibold tabular-nums">{guaranies(Number(pago.monto_gs))}</p>
          <p className="mt-1 text-[.82rem] text-[#6b7280]">Referencia {pago.referencia}</p>

          {pago.estado === 'pendiente' ? (
            <form action={resolverPago} className="mt-6 grid gap-2">
              <input type="hidden" name="referencia" value={pago.referencia} />
              <button name="resultado" value="aprobar" className="rounded-xl bg-[#1a56db] py-3.5 font-semibold text-white hover:bg-[#1648b8]">Simular pago aprobado</button>
              <button name="resultado" value="rechazar" className="rounded-xl py-3 font-medium text-[#b42318] ring-1 ring-[#f1c4c0] hover:bg-[#fff5f4]">Simular pago rechazado</button>
            </form>
          ) : (
            <p className="mt-6 rounded-xl bg-[#f3f4f6] px-4 py-3 text-[.95rem]">Este cobro ya fue procesado ({pago.estado}).</p>
          )}
        </div>
        <p className="mt-4 text-center text-[.8rem] text-[#6b7280]">Al resolver, la pasarela avisa al comercio con un aviso firmado (webhook).</p>
      </div>
    </div>
  );
}
