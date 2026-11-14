import { notFound } from 'next/navigation';
import { sesionActual } from '@/lib/supabase/servidor';
import { diaSemana, localAUtc, partesLocales, sumarDias } from '@/lib/tiempo';
import { leerRango, type BloqueoPanel, type FranjaPanel, type ReservaPanel } from '@/lib/agenda';
import Agenda from './Agenda';

export const metadata = { title: 'Agenda' };

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export default async function PaginaAgenda({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ fecha?: string; vista?: string }> }) {
  const { slug } = await params;
  const q = await searchParams;
  const sesion = await sesionActual();
  const m = sesion?.membresias.find(x => x.negocios.slug === slug);
  if (!sesion || !m) notFound();
  const db = sesion.db;

  const { data: negocio } = await db.from('negocios').select('id, zona_horaria, intervalo_min').eq('id', m.negocio_id).single();
  if (!negocio) notFound();
  const zona = negocio.zona_horaria as string;
  const hoy = partesLocales(new Date(), zona).fecha;
  const fecha = q.fecha && FECHA.test(q.fecha) ? q.fecha : hoy;
  const vista = q.vista === 'semana' ? 'semana' : 'dia';

  // La semana arranca el lunes.
  const lunes = sumarDias(fecha, -((diaSemana(fecha) + 6) % 7));
  const dias = vista === 'semana' ? Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i)) : [fecha];
  const desde = localAUtc(dias[0], '00:00', zona).toISOString();
  const hasta = localAUtc(sumarDias(dias.at(-1)!, 1), '00:00', zona).toISOString();
  const rango = `[${desde},${hasta})`;

  const [profesionales, horarios, bloqueos, reservas, ofertas] = await Promise.all([
    db.from('profesionales').select('id, nombre').eq('negocio_id', negocio.id).eq('activo', true).order('orden'),
    db.from('horarios').select('profesional_id, dia_semana, desde, hasta').eq('negocio_id', negocio.id),
    db.from('bloqueos').select('profesional_id, periodo, motivo').eq('negocio_id', negocio.id).overlaps('periodo', rango),
    db.from('reservas')
      .select('id, numero, codigo, estado, periodo, precio_gs, sena_gs, expira_en, profesional_id, servicio_id, servicios(nombre), clientes(nombre, telefono, correo), pagos(estado, creado_en)')
      .eq('negocio_id', negocio.id).overlaps('periodo', rango).order('periodo'),
    db.from('profesional_servicios').select('profesional_id, servicio_id').eq('negocio_id', negocio.id),
  ]);

  const listaReservas: ReservaPanel[] = (reservas.data ?? []).map(r => {
    const { inicio, fin } = leerRango(r.periodo);
    const cliente = r.clientes as unknown as { nombre: string; telefono: string; correo: string | null };
    return {
      id: r.id, numero: r.numero, codigo: r.codigo, estado: r.estado, inicio, fin,
      precioGs: Number(r.precio_gs), senaGs: Number(r.sena_gs), expiraEn: r.expira_en,
      profesionalId: r.profesional_id, servicioId: r.servicio_id,
      servicio: (r.servicios as unknown as { nombre: string }).nombre,
      cliente: cliente.nombre, telefono: cliente.telefono, correo: cliente.correo,
      pago: ((r.pagos as unknown as { estado: ReservaPanel['pago']; creado_en: string }[]) ?? [])
        .sort((a, b) => b.creado_en.localeCompare(a.creado_en))[0]?.estado ?? null,
    };
  });
  const franjas: FranjaPanel[] = (horarios.data ?? []).map(h => ({ profesionalId: h.profesional_id, diaSemana: h.dia_semana, desde: h.desde.slice(0, 5), hasta: h.hasta.slice(0, 5) }));
  const listaBloqueos: BloqueoPanel[] = (bloqueos.data ?? []).map(b => ({ profesionalId: b.profesional_id, motivo: b.motivo, ...leerRango(b.periodo) }));

  return (
    <Agenda
      key={`${fecha}-${vista}`}
      slug={slug}
      zona={zona}
      hoy={hoy}
      fecha={fecha}
      vista={vista}
      dias={dias}
      profesionales={profesionales.data ?? []}
      ofertas={ofertas.data ?? []}
      franjas={franjas}
      bloqueos={listaBloqueos}
      reservas={listaReservas}
    />
  );
}
