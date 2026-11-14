'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'motion/react';
import { salir } from '../entrar/acciones';

type Props = { slug: string; nombre: string; rol: 'dueno' | 'personal'; correo: string; otros: { slug: string; nombre: string }[] };

export default function NavPanel({ slug, nombre, rol, correo, otros }: Props) {
  const ruta = usePathname();
  const base = `/panel/${slug}`;
  const pestañas = [
    { href: base, texto: 'Agenda' },
    { href: `${base}/mensajes`, texto: 'Mensajes' },
    ...(rol === 'dueno' ? [{ href: `${base}/catalogo`, texto: 'Catálogo' }] : []),
  ];
  const activa = [...pestañas].reverse().find(p => ruta === p.href || ruta.startsWith(`${p.href}/`))?.href ?? base;

  return (
    <header className="mx-auto max-w-7xl px-4 pt-4 sm:px-6">
      <div className="vidrio flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3" style={{ ['--retraso' as string]: '2s' }}>
        <div className="min-w-0">
          <p className="etq !text-[.68rem]">Panel · {rol === 'dueno' ? 'dueño' : 'equipo'}</p>
          <p className="rotulo truncate text-[1.6rem] !leading-tight">{nombre}</p>
        </div>
        <nav aria-label="Secciones del panel" className="order-3 flex w-full gap-1 sm:order-none sm:w-auto">
          {pestañas.map(p => {
            const esta = p.href === activa;
            return (
              <Link key={p.href} href={p.href} aria-current={esta ? 'page' : undefined} className="relative rounded-full px-4 py-2 text-[.95rem] font-medium">
                {esta && <motion.span layoutId="pestaña" className="absolute inset-0 rounded-full" style={{ background: 'var(--acento)' }} transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
                <span className="relative" style={{ color: esta ? 'var(--acento-tinta)' : undefined }}>{p.texto}</span>
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-[.88rem]">
          <Link href={`/${slug}`} className="hidden text-[color:var(--texto-2)] hover:text-[color:var(--texto)] md:inline">Ver la vidriera ↗</Link>
          {otros.map(o => <Link key={o.slug} href={`/panel/${o.slug}`} className="text-[color:var(--texto-2)] hover:text-[color:var(--texto)]">{o.nombre}</Link>)}
          <span className="hidden text-[color:var(--texto-2)] lg:inline">{correo}</span>
          <form action={salir}><button type="submit" className="rounded-full px-3 py-1.5 font-medium" style={{ boxShadow: 'inset 0 0 0 1px var(--linea)' }}>Salir</button></form>
        </div>
      </div>
    </header>
  );
}
