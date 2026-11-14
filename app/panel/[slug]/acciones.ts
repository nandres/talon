'use server';

import { revalidatePath } from 'next/cache';
import { sesionActual } from '@/lib/supabase/servidor';
import { turnosLibres, unirPorHorario } from '@/lib/disponibilidad';
import { partesLocales, sumarDias } from '@/lib/tiempo';
import { leerRango, MENSAJES_ERROR, type EstadoReserva } from '@/lib/agenda';
import type { DiaDisponible } from '@/lib/tipos';

type Resultado<T = null> = { ok: true; datos: T } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ESTADOS: EstadoReserva[] = ['confirmada', 'cancelada', 'completada', 'ausente'];

async function miembro(slug: string) {
  const sesion = await sesionActual();
  const m = sesion?.membresias.find(x => x.negocios.slug === slug);
  return sesion && m ? { db: sesion.db, negocioId: m.negocio_id, rol: m.rol } : null;
}

const error = (codigo?: string): Resultado<never> => ({ ok: false, error: MENSAJES_ERROR[codigo ?? ''] ?? 'No se pudo guardar. Probá de nuevo.' });

export async function cambiarEstado(slug: string, reservaId: string, estado: EstadoReserva): Promise<Resultado> {
  if (!UUID.test(reservaId) || !ESTADOS.includes(estado)) return error('TAL06');
  const m = await miembro(slug);
  if (!m) return { ok: false, error: 'Tu sesión venció. Volvé a entrar.' };
  const { error: e } = await m.db.rpc('cambiar_estado_reserva', { p_reserva: reservaId, p_estado: estado });
  if (e) return error(e.code);
  revalidatePath(`/panel/${slug}`, 'layout');
  return { ok: true, datos: null };
}

/** Huecos libres para mover un turno: los próximos 21 días, sin contar el propio turno. */
export async function huecosParaMover(slug: string, reservaId: string, profesionalId: string | null): Promise<Resultado<DiaDisponible[]>> {
  if (!UUID.test(reservaId) || (profesionalId && !UUID.test(profesionalId))) return error('TAL01');
  const m = await miembro(slug);
  if (!m) return { ok: false, error: 'Tu sesión venció. Volvé a entrar.' };

  const [{ data: neg }, { data: res }] = await Promise.all([
    m.db.from('negocios').select('zona_horaria, intervalo_min').eq('id', m.negocioId).single(),
    m.db.from('reservas').select('servicio_id, periodo').eq('id', reservaId).single(),
  ]);
  if (!neg || !res) return error('TAL01');
  const { inicio, fin } = leerRango(res.periodo);
  const duracionMin = Math.round((Date.parse(fin) - Date.parse(inicio)) / 60000);

  const { data: ofertas } = await m.db.from('profesional_servicios').select('profesional_id, profesionales!inner(activo)').eq('servicio_id', res.servicio_id).eq('profesionales.activo', true);
  let profesionales = (ofertas ?? []).map(o => o.profesional_id as string);
  if (profesionalId) profesionales = profesionales.filter(p => p === profesionalId);
  if (!profesionales.length) return { ok: true, datos: [] };

  const ahora = new Date();
  const hasta = new Date(ahora.getTime() + 22 * 864e5);
  const rango = `[${ahora.toISOString()},${hasta.toISOString()})`;
  const [{ data: horarios }, { data: ocupadas }, { data: bloqueos }] = await Promise.all([
    m.db.from('horarios').select('profesional_id, dia_semana, desde, hasta').in('profesional_id', profesionales),
    m.db.from('reservas').select('id, profesional_id, periodo, estado, expira_en').in('profesional_id', profesionales).neq('estado', 'cancelada').overlaps('periodo', rango),
    m.db.from('bloqueos').select('profesional_id, periodo').eq('negocio_id', m.negocioId).overlaps('periodo', rango),
  ]);

  const ocupados = [
    ...(ocupadas ?? [])
      .filter(r => r.id !== reservaId && !(r.estado === 'pendiente_pago' && r.expira_en && Date.parse(r.expira_en) <= Date.now()))
      .map(r => { const x = leerRango(r.periodo); return { profesionalId: r.profesional_id as string, inicio: new Date(x.inicio), fin: new Date(x.fin) }; }),
    ...(bloqueos ?? []).flatMap(b => {
      const x = leerRango(b.periodo);
      return (b.profesional_id ? [b.profesional_id as string] : profesionales).map(p => ({ profesionalId: p, inicio: new Date(x.inicio), fin: new Date(x.fin) }));
    }),
  ];
  const franjas = (horarios ?? []).map(h => ({ profesionalId: h.profesional_id, diaSemana: h.dia_semana, desde: h.desde.slice(0, 5), hasta: h.hasta.slice(0, 5) }));

  const hoy = partesLocales(ahora, neg.zona_horaria).fecha;
  const dias: DiaDisponible[] = [];
  for (let i = 0; i < 21; i++) {
    const fecha = sumarDias(hoy, i);
    const libres = turnosLibres({ fecha, zona: neg.zona_horaria, profesionales, franjas, ocupados, duracionMin, intervaloMin: neg.intervalo_min, ahora, anticipacionMin: 0, ventanaDias: 21 });
    dias.push({ fecha, turnos: unirPorHorario(libres).map(t => ({ inicio: t.inicio.toISOString(), profesionales: t.profesionales })) });
  }
  return { ok: true, datos: dias };
}

export async function mover(slug: string, reservaId: string, inicio: string, profesionalId: string): Promise<Resultado> {
  if (!UUID.test(reservaId) || !UUID.test(profesionalId) || Number.isNaN(Date.parse(inicio))) return error('TAL02');
  const m = await miembro(slug);
  if (!m) return { ok: false, error: 'Tu sesión venció. Volvé a entrar.' };
  const { error: e } = await m.db.rpc('reprogramar_reserva', { p_reserva: reservaId, p_inicio: inicio, p_profesional: profesionalId });
  if (e) return error(e.code);
  revalidatePath(`/panel/${slug}`, 'layout');
  return { ok: true, datos: null };
}
