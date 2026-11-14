import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { clientePublico } from '@/lib/supabase/publico';
import { fechaLarga, guaranies, hora, numeroTalon } from '@/lib/formato';
import Escaparate from '../../Escaparate';
import TalonVaho from '../../TalonVaho';
import BotonPagar from './BotonPagar';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Mi turno', robots: { index: false } };

type Turno = {
  codigo: string; numero: number; estado: string; inicio: string; fin: string; sena_gs: number; expira_en: string | null;
  cliente: string; servicio: string; profesional: string; negocio: string; slug: string; zona_horaria: string;
  foto: string | null; tema: 'noche' | 'dia'; pago: string | null;
};

export default async function MiTurno({ params, searchParams }: { params: Promise<{ codigo: string }>; searchParams: Promise<{ pago?: string }> }) {
  const { codigo } = await params;
  const { pago: vuelta } = await searchParams;
  if (!/^[0-9A-F]{8}$/i.test(codigo)) notFound();
  const { data } = await clientePublico().rpc('turno_por_codigo', { p_codigo: codigo });
  const t = (data as Turno[] | null)?.[0];
  if (!t) notFound();

  const zona = t.zona_horaria;
  const vigente = t.estado === 'pendiente_pago' && t.expira_en && Date.parse(t.expira_en) > Date.now();
  const mensaje = (() => {
    if (t.estado === 'confirmada') return vuelta === 'aprobado' ? 'Recibimos la seña: tu turno quedó confirmado. Te llega la confirmación por WhatsApp.' : 'Tu turno está confirmado. Te mandamos un recordatorio el día anterior.';
    if (t.estado === 'completada') return 'Este turno ya fue atendido. ¡Gracias por venir!';
    if (t.estado === 'ausente') return 'Este turno figura como no asistido.';
    if (t.pago === 'reintegrar') return 'El pago llegó después de que se liberara el horario. El local te va a devolver la seña.';
    if (t.estado === 'cancelada') return 'Este turno fue cancelado.';
    if (vigente) return vuelta === 'rechazado' ? 'El pago no se aprobó. Podés intentarlo de nuevo mientras el horario siga reservado.' : `Falta la seña para confirmarlo. Te guardamos el horario hasta las ${hora(t.expira_en!, zona)}.`;
    return 'Venció el plazo para pagar la seña y el horario se liberó.';
  })();

  return (
    <Escaparate foto={t.foto} tema={t.tema}>
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-5 sm:px-8">
        <Link href={`/${t.slug}`} className="etq vd-sombra hover:text-[color:var(--texto)]">← {t.negocio}</Link>
      </nav>
      <main className="mx-auto max-w-5xl px-4 pb-24 pt-[8vh] sm:px-8">
        <TalonVaho numero={numeroTalon(t.numero)} enfocar={false}>
          <p className="mt-6 text-[1.15rem] font-medium">{t.cliente}, {t.servicio.toLowerCase()} con {t.profesional}</p>
          <p className="mt-1 text-[color:var(--texto-2)] first-letter:uppercase">{fechaLarga(t.inicio, zona)} · {hora(t.inicio, zona)} a {hora(t.fin, zona)}</p>
          <p className="mt-4 text-[.95rem]">Código <span className="font-semibold tracking-[.12em]">{t.codigo}</span></p>
          <div className="filete mx-auto my-5 max-w-xs" />
          <p className="mx-auto max-w-[42ch] text-[.98rem] leading-relaxed" role="status">{mensaje}</p>
          {vigente && <BotonPagar codigo={t.codigo} montoGs={t.sena_gs} />}
          {(t.estado === 'cancelada' || (t.estado === 'pendiente_pago' && !vigente)) && (
            <Link href={`/${t.slug}`} className="mt-5 inline-block font-medium text-[color:var(--acento)] underline decoration-1 underline-offset-4">Sacar otro turno</Link>
          )}
          {t.sena_gs > 0 && t.estado === 'confirmada' && <p className="mt-3 text-[.88rem] text-[color:var(--texto-2)]">Seña pagada: {guaranies(t.sena_gs)}</p>}
        </TalonVaho>
      </main>
    </Escaparate>
  );
}
