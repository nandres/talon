import { notFound } from 'next/navigation';
import { sesionActual } from '@/lib/supabase/servidor';
import Catalogo from './Catalogo';

export const metadata = { title: 'Catálogo' };

export default async function PaginaCatalogo({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sesion = await sesionActual();
  const m = sesion?.membresias.find(x => x.negocios.slug === slug);
  if (!sesion || !m || m.rol !== 'dueno') notFound();

  const [servicios, profesionales, ofertas, horarios] = await Promise.all([
    sesion.db.from('servicios').select('id, nombre, descripcion, duracion_min, precio_gs, activo').eq('negocio_id', m.negocio_id).order('orden').order('nombre'),
    sesion.db.from('profesionales').select('id, nombre, especialidad, activo').eq('negocio_id', m.negocio_id).order('orden').order('nombre'),
    sesion.db.from('profesional_servicios').select('profesional_id, servicio_id').eq('negocio_id', m.negocio_id),
    sesion.db.from('horarios').select('profesional_id, dia_semana, desde, hasta').eq('negocio_id', m.negocio_id).order('desde'),
  ]);

  return (
    <Catalogo
      slug={slug}
      servicios={(servicios.data ?? []).map(s => ({ id: s.id, nombre: s.nombre, descripcion: s.descripcion ?? '', duracionMin: s.duracion_min, precioGs: Number(s.precio_gs), activo: s.activo }))}
      profesionales={(profesionales.data ?? []).map(p => ({
        id: p.id, nombre: p.nombre, especialidad: p.especialidad ?? '', activo: p.activo,
        servicios: (ofertas.data ?? []).filter(o => o.profesional_id === p.id).map(o => o.servicio_id),
      }))}
      horarios={(horarios.data ?? []).map(h => ({ profesionalId: h.profesional_id, dia: h.dia_semana, desde: h.desde.slice(0, 5), hasta: h.hasta.slice(0, 5) }))}
    />
  );
}
