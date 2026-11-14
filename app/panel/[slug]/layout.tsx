import { notFound, redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { sesionActual } from '@/lib/supabase/servidor';
import type { Negocio } from '@/lib/tipos';
import Escaparate from '../../Escaparate';
import NavPanel from './NavPanel';

export const dynamic = 'force-dynamic';

export default async function LayoutPanel({ children, params }: { children: ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sesion = await sesionActual();
  if (!sesion) redirect('/panel/entrar');
  const membresia = sesion.membresias.find(m => m.negocios.slug === slug);
  if (!membresia) notFound();

  const { data: negocio } = await sesion.db.from('negocios').select('*').eq('slug', slug).single<Negocio>();
  if (!negocio) notFound();

  return (
    <Escaparate foto={negocio.foto} tema={negocio.tema} panel>
      <NavPanel slug={slug} nombre={negocio.nombre} rol={membresia.rol} correo={sesion.usuario.email ?? ''}
        otros={sesion.membresias.filter(m => m.negocios.slug !== slug).map(m => ({ slug: m.negocios.slug, nombre: m.negocios.nombre }))} />
      <main className="mx-auto max-w-7xl px-4 pb-24 pt-6 sm:px-6">{children}</main>
    </Escaparate>
  );
}
