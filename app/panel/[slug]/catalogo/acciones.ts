'use server';

import { revalidatePath } from 'next/cache';
import { sesionActual } from '@/lib/supabase/servidor';

type Resultado = { ok: true; id?: string } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

async function dueno(slug: string) {
  const sesion = await sesionActual();
  const m = sesion?.membresias.find(x => x.negocios.slug === slug);
  return sesion && m?.rol === 'dueno' ? { db: sesion.db, negocioId: m.negocio_id } : null;
}

const SIN_PERMISO: Resultado = { ok: false, error: 'Solo el dueño puede cambiar el catálogo.' };

export type DatosServicio = { id: string | null; nombre: string; descripcion: string; duracionMin: number; precioGs: number; activo: boolean };

export async function guardarServicio(slug: string, s: DatosServicio): Promise<Resultado> {
  const d = await dueno(slug);
  if (!d) return SIN_PERMISO;
  const nombre = s.nombre.trim();
  if (nombre.length < 2 || nombre.length > 80) return { ok: false, error: 'El nombre debe tener entre 2 y 80 letras.' };
  if (!Number.isInteger(s.duracionMin) || s.duracionMin < 5 || s.duracionMin > 480 || s.duracionMin % 5) return { ok: false, error: 'La duración va de 5 en 5 minutos, hasta 8 horas.' };
  if (!Number.isInteger(s.precioGs) || s.precioGs < 0 || s.precioGs > 100_000_000) return { ok: false, error: 'Revisá el precio.' };
  const fila = { nombre, descripcion: s.descripcion.trim().slice(0, 200) || null, duracion_min: s.duracionMin, precio_gs: s.precioGs, activo: s.activo };

  const r = s.id
    ? await d.db.from('servicios').update(fila).eq('id', s.id).eq('negocio_id', d.negocioId).select('id').single()
    : await d.db.from('servicios').insert({ ...fila, negocio_id: d.negocioId, orden: 99 }).select('id').single();
  if (r.error) return { ok: false, error: 'No se pudo guardar el servicio.' };
  revalidatePath(`/panel/${slug}`, 'layout');
  revalidatePath(`/${slug}`);
  return { ok: true, id: r.data.id };
}

export type DatosProfesional = { id: string | null; nombre: string; especialidad: string; activo: boolean; servicios: string[] };

export async function guardarProfesional(slug: string, p: DatosProfesional): Promise<Resultado> {
  const d = await dueno(slug);
  if (!d) return SIN_PERMISO;
  const nombre = p.nombre.trim();
  if (nombre.length < 2 || nombre.length > 80) return { ok: false, error: 'El nombre debe tener entre 2 y 80 letras.' };
  if (!p.servicios.every(x => UUID.test(x))) return { ok: false, error: 'Servicio inválido.' };
  const fila = { nombre, especialidad: p.especialidad.trim().slice(0, 80) || null, activo: p.activo };

  const r = p.id
    ? await d.db.from('profesionales').update(fila).eq('id', p.id).eq('negocio_id', d.negocioId).select('id').single()
    : await d.db.from('profesionales').insert({ ...fila, negocio_id: d.negocioId, orden: 99 }).select('id').single();
  if (r.error) return { ok: false, error: 'No se pudo guardar el profesional.' };

  const id = r.data.id as string;
  await d.db.from('profesional_servicios').delete().eq('profesional_id', id);
  if (p.servicios.length) {
    const { error } = await d.db.from('profesional_servicios').insert(p.servicios.map(s => ({ negocio_id: d.negocioId, profesional_id: id, servicio_id: s })));
    if (error) return { ok: false, error: 'Se guardó el profesional, pero no sus servicios.' };
  }
  revalidatePath(`/panel/${slug}`, 'layout');
  revalidatePath(`/${slug}`);
  return { ok: true, id };
}

export type Franja = { dia: number; desde: string; hasta: string };

export async function guardarHorarios(slug: string, profesionalId: string, franjas: Franja[]): Promise<Resultado> {
  const d = await dueno(slug);
  if (!d) return SIN_PERMISO;
  if (!UUID.test(profesionalId) || franjas.length > 40) return { ok: false, error: 'Datos inválidos.' };
  for (const f of franjas) {
    if (!Number.isInteger(f.dia) || f.dia < 0 || f.dia > 6 || !HORA.test(f.desde) || !HORA.test(f.hasta) || f.desde >= f.hasta) {
      return { ok: false, error: 'Cada franja necesita un "desde" anterior al "hasta".' };
    }
  }
  for (let dia = 0; dia < 7; dia++) {
    const del = franjas.filter(f => f.dia === dia).sort((a, b) => a.desde.localeCompare(b.desde));
    if (del.some((f, i) => i > 0 && f.desde < del[i - 1].hasta)) return { ok: false, error: 'Hay franjas que se pisan en el mismo día.' };
  }
  const { error } = await d.db.rpc('guardar_horarios', { p_profesional: profesionalId, p_franjas: franjas });
  if (error) return { ok: false, error: 'No se pudieron guardar los horarios.' };
  revalidatePath(`/panel/${slug}`, 'layout');
  revalidatePath(`/${slug}`);
  return { ok: true };
}
