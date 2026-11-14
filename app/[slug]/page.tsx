import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { clientePublico } from '@/lib/supabase/publico';
import type { Negocio, Oferta, Profesional, Servicio } from '@/lib/tipos';
import Escaparate from '../Escaparate';
import { Aparecer, Pintar } from '../animaciones';
import BotonWhatsApp from './BotonWhatsApp';
import Reserva from './Reserva';

export const dynamic = 'force-dynamic';

const cargar = cache(async (slug: string) => {
  const db = clientePublico();
  const { data: negocio } = await db.from('negocios').select('*').eq('slug', slug).maybeSingle<Negocio>();
  if (!negocio) return null;
  const [servicios, profesionales, ofertas] = await Promise.all([
    db.from('servicios').select('id, nombre, descripcion, duracion_min, precio_gs').eq('negocio_id', negocio.id).eq('activo', true).order('orden'),
    db.from('profesionales').select('id, nombre, especialidad').eq('negocio_id', negocio.id).eq('activo', true).order('orden'),
    db.from('profesional_servicios').select('profesional_id, servicio_id').eq('negocio_id', negocio.id),
  ]);
  return {
    negocio,
    servicios: (servicios.data ?? []) as Servicio[],
    profesionales: (profesionales.data ?? []) as Profesional[],
    ofertas: (ofertas.data ?? []) as Oferta[],
  };
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const datos = await cargar((await params).slug);
  return datos ? { title: `Reservá en ${datos.negocio.nombre}` } : {};
}

export default async function PaginaNegocio({ params }: { params: Promise<{ slug: string }> }) {
  const datos = await cargar((await params).slug);
  if (!datos) notFound();
  const { negocio } = datos;

  return (
    <Escaparate foto={negocio.foto} tema={negocio.tema}>
      <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 pt-5 sm:px-8">
        <Link href="/" className="etq vd-sombra hover:text-[color:var(--texto)]">← Talón</Link>
        {negocio.telefono && <BotonWhatsApp telefono={negocio.telefono} demo={negocio.demo} />}
      </nav>

      <header className="mx-auto max-w-5xl px-4 pb-10 pt-[12vh] sm:px-8">
        <Aparecer><p className="etq vd-sombra">{negocio.rubro}{negocio.direccion ? ` · ${negocio.direccion}` : ''}</p></Aparecer>
        <Pintar className="rotulo mt-4 max-w-[12ch] text-[clamp(3.2rem,11vw,8.5rem)]">{negocio.nombre}</Pintar>
        <Aparecer i={8}>
          <div className="filete mt-6 max-w-md" />
          {negocio.lema && <p className="vd-sombra mt-4 text-[1.1rem] text-[color:var(--texto-2)]">{negocio.lema}</p>}
        </Aparecer>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 sm:px-8">
        <Reserva {...datos} />
      </main>
    </Escaparate>
  );
}
