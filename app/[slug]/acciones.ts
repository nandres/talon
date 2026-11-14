'use server';

import { clientePublico } from '@/lib/supabase/publico';
import { turnosLibres, unirPorHorario, type Franja } from '@/lib/disponibilidad';
import { partesLocales, sumarDias } from '@/lib/tiempo';
import type { DiaDisponible, Negocio, Talon } from '@/lib/tipos';

type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function negocioPorSlug(slug: string) {
  const db = clientePublico();
  const { data } = await db.from('negocios').select('*').eq('slug', slug).maybeSingle<Negocio>();
  return { db, negocio: data };
}

/** Todos los turnos libres de la ventana de reservas, agrupados por día. */
export async function consultarHorarios(slug: string, servicioId: string, profesionalId: string | null): Promise<Resultado<DiaDisponible[]>> {
  if (!UUID.test(servicioId) || (profesionalId && !UUID.test(profesionalId))) return { ok: false, error: 'Elección inválida.' };
  const { db, negocio } = await negocioPorSlug(slug);
  if (!negocio) return { ok: false, error: 'No encontramos el negocio.' };

  const ahora = new Date();
  const hasta = new Date(ahora.getTime() + (negocio.ventana_dias + 1) * 864e5);

  const [servicio, ofertas, ocupados] = await Promise.all([
    db.from('servicios').select('duracion_min').eq('id', servicioId).eq('negocio_id', negocio.id).maybeSingle(),
    db.from('profesional_servicios').select('profesional_id, profesionales!inner(activo)').eq('servicio_id', servicioId).eq('profesionales.activo', true),
    db.rpc('agenda_ocupada', { p_slug: slug, p_desde: ahora.toISOString(), p_hasta: hasta.toISOString() }),
  ]);
  if (!servicio.data || ofertas.error || ocupados.error) return { ok: false, error: 'No pudimos cargar los horarios. Probá de nuevo.' };

  let profesionales = (ofertas.data ?? []).map(o => o.profesional_id as string);
  if (profesionalId) profesionales = profesionales.filter(p => p === profesionalId);
  if (!profesionales.length) return { ok: true, datos: [] };

  const { data: horarios } = await db.from('horarios').select('profesional_id, dia_semana, desde, hasta').in('profesional_id', profesionales);
  const franjas: Franja[] = (horarios ?? []).map(h => ({ profesionalId: h.profesional_id, diaSemana: h.dia_semana, desde: h.desde.slice(0, 5), hasta: h.hasta.slice(0, 5) }));
  const listaOcupados = (ocupados.data as { profesional_id: string; inicio: string; fin: string }[]).map(o => ({ profesionalId: o.profesional_id, inicio: new Date(o.inicio), fin: new Date(o.fin) }));

  const hoy = partesLocales(ahora, negocio.zona_horaria).fecha;
  const dias: DiaDisponible[] = [];
  for (let i = 0; i <= negocio.ventana_dias; i++) {
    const fecha = sumarDias(hoy, i);
    const libres = turnosLibres({
      fecha, zona: negocio.zona_horaria, profesionales, franjas, ocupados: listaOcupados,
      duracionMin: servicio.data.duracion_min, intervaloMin: negocio.intervalo_min,
      ahora, anticipacionMin: negocio.anticipacion_min, ventanaDias: negocio.ventana_dias,
    });
    dias.push({ fecha, turnos: unirPorHorario(libres).map(t => ({ inicio: t.inicio.toISOString(), profesionales: t.profesionales })) });
  }
  return { ok: true, datos: dias };
}

const MENSAJES: Record<string, string> = {
  TAL01: 'Ese servicio o profesional ya no está disponible.',
  TAL02: 'Ese horario ya no se puede reservar. Elegí otro.',
  TAL03: 'Revisá tu nombre y tu teléfono.',
  TAL04: 'Ese horario quedó fuera de la atención. Elegí otro.',
  TAL05: 'Alguien tomó ese horario hace un momento. Elegí otro.',
};

export type PedidoReserva = {
  slug: string;
  servicioId: string;
  profesionales: string[];   // en orden de preferencia; con "cualquiera" se prueba el siguiente si uno se ocupa
  inicio: string;
  nombre: string;
  telefono: string;
  correo: string;
};

export async function reservar(p: PedidoReserva): Promise<Resultado<Talon>> {
  if (!UUID.test(p.servicioId) || !p.profesionales.length || p.profesionales.length > 10 || !p.profesionales.every(x => UUID.test(x))) {
    return { ok: false, error: MENSAJES.TAL01 };
  }
  if (Number.isNaN(Date.parse(p.inicio))) return { ok: false, error: MENSAJES.TAL02 };

  const db = clientePublico();
  let ultimoError = MENSAJES.TAL05;
  for (const profesionalId of p.profesionales) {
    const { data, error } = await db.rpc('reservar_turno', {
      p_slug: p.slug, p_servicio: p.servicioId, p_profesional: profesionalId, p_inicio: p.inicio,
      p_nombre: p.nombre.slice(0, 80), p_telefono: p.telefono.slice(0, 20), p_correo: p.correo.slice(0, 120) || null,
    });
    if (!error && data?.[0]) {
      const r = data[0];
      return { ok: true, datos: { codigo: r.codigo, numero: r.numero, estado: r.estado, senaGs: Number(r.sena_gs), inicio: r.inicio, fin: r.fin, profesionalId } };
    }
    ultimoError = MENSAJES[error?.code ?? ''] ?? 'No pudimos reservar. Probá de nuevo en un momento.';
    if (error?.code !== 'TAL05') break; // solo vale la pena probar con otro profesional si el horario estaba tomado
  }
  return { ok: false, error: ultimoError };
}
