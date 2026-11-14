import Image from 'next/image';
import Link from 'next/link';
import { clientePublico } from '@/lib/supabase/publico';
import Escaparate from './Escaparate';
import { Aparecer, Pintar } from './animaciones';

export const dynamic = 'force-dynamic';

export default async function Inicio() {
  const { data: negocios } = await clientePublico()
    .from('negocios')
    .select('slug, nombre, rubro, direccion, foto, lema')
    .order('nombre');

  return (
    <Escaparate foto="/vidriera/calle.jpg" tema="noche">
      <header className="mx-auto max-w-5xl px-4 pb-12 pt-[16vh] sm:px-8">
        <Pintar as="h1" className="rotulo text-[clamp(4rem,16vw,11rem)]">Talón</Pintar>
        <Aparecer i={6}>
          <div className="filete mt-6 max-w-md" />
          <p className="vd-sombra mt-5 max-w-[34ch] text-[clamp(1.15rem,2.4vw,1.45rem)] leading-snug">
            Turnos en línea para negocios de barrio. El cliente elige servicio, profesional y horario, y se lleva su número.
          </p>
        </Aparecer>
      </header>

      <main className="mx-auto max-w-5xl px-4 pb-28 sm:px-8">
        <Aparecer i={9}>
          <p className="etq vd-sombra mb-3">Vidrieras de demostración</p>
        </Aparecer>
        <ul className="grid gap-4 md:grid-cols-2">
          {(negocios ?? []).map((n, i) => (
            <li key={n.slug}>
              <Aparecer i={10 + i * 2}>
                <Link href={`/${n.slug}`} className="vidrio group grid grid-cols-[6.5rem_1fr] items-center gap-4 p-2.5 transition-transform duration-300 hover:-translate-y-1 sm:grid-cols-[8rem_1fr]" style={{ ['--retraso' as string]: `${i * 1.4}s` }}>
                  <span className="relative block aspect-[4/5] overflow-hidden rounded-[14px]">
                    {n.foto && <Image src={n.foto} alt="" fill sizes="8rem" className="object-cover transition-transform duration-700 group-hover:scale-105" />}
                  </span>
                  <span className="pr-3">
                    <span className="etq block">{n.rubro}</span>
                    <span className="mt-1 block font-rotulo text-[1.6rem] italic leading-tight">{n.nombre}</span>
                    {n.lema && <span className="mt-1 block text-[.95rem] text-[color:var(--texto-2)]">{n.lema}</span>}
                    <span className="mt-3 inline-flex items-center gap-1.5 text-[.9rem] font-medium text-[color:var(--acento)]">
                      Sacar turno <span aria-hidden className="transition-transform duration-300 group-hover:translate-x-1">→</span>
                    </span>
                  </span>
                </Link>
              </Aparecer>
            </li>
          ))}
        </ul>
        <p className="vd-sombra mt-10 text-[.9rem] text-[color:var(--texto-2)]">Negocios, personas y fotos son ficticios. Las fotos fueron generadas con IA.</p>
      </main>
    </Escaparate>
  );
}
