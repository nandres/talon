import Link from 'next/link';
import { notFound } from 'next/navigation';
import { sesionActual } from '@/lib/supabase/servidor';
import { hora } from '@/lib/formato';
import { partesLocales } from '@/lib/tiempo';
import EnviarAhora from './EnviarAhora';

export const metadata = { title: 'Mensajes' };

const TIPOS: Record<string, string> = {
  confirmacion: 'Confirmación',
  recordatorio: 'Recordatorio',
  cancelacion: 'Cancelación',
  reprogramacion: 'Cambio de horario',
};
const FILTROS = [
  { id: 'cola', texto: 'Por salir' },
  { id: 'enviados', texto: 'Enviados' },
  { id: 'todos', texto: 'Todos' },
] as const;

export default async function Mensajes({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ ver?: string }> }) {
  const { slug } = await params;
  const { ver } = await searchParams;
  const filtro = FILTROS.find(f => f.id === ver)?.id ?? 'cola';
  const sesion = await sesionActual();
  const m = sesion?.membresias.find(x => x.negocios.slug === slug);
  if (!sesion || !m) notFound();

  const { data: negocio } = await sesion.db.from('negocios').select('zona_horaria').eq('id', m.negocio_id).single();
  const zona = negocio?.zona_horaria ?? 'America/Asuncion';

  let consulta = sesion.db.from('mensajes')
    .select('id, tipo, canal, destino, cuerpo, estado, programado_para, enviado_en, reservas(numero)')
    .eq('negocio_id', m.negocio_id);
  if (filtro === 'cola') consulta = consulta.eq('estado', 'en_cola').order('programado_para', { ascending: true });
  else if (filtro === 'enviados') consulta = consulta.eq('estado', 'enviado').order('enviado_en', { ascending: false });
  else consulta = consulta.order('creado_en', { ascending: false });
  const { data: mensajes } = await consulta.limit(80);

  const [{ count: enCola }, { count: proximas24 }, { count: yaTocan }] = await Promise.all([
    sesion.db.from('mensajes').select('id', { count: 'exact', head: true }).eq('negocio_id', m.negocio_id).eq('estado', 'en_cola'),
    sesion.db.from('mensajes').select('id', { count: 'exact', head: true }).eq('negocio_id', m.negocio_id).eq('estado', 'en_cola').lte('programado_para', new Date(Date.now() + 864e5).toISOString()),
    sesion.db.from('mensajes').select('id', { count: 'exact', head: true }).eq('negocio_id', m.negocio_id).eq('estado', 'en_cola').lte('programado_para', new Date().toISOString()),
  ]);

  const cuando = (iso: string) => {
    const p = partesLocales(new Date(iso), zona);
    return `${p.fecha.slice(8)}/${p.fecha.slice(5, 7)} ${hora(iso, zona)}`;
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[18rem_1fr]">
      <aside className="vidrio h-fit p-5 lg:sticky lg:top-6">
        <h1 className="font-rotulo text-[2rem] italic leading-tight">Mensajes</h1>
        <p className="mt-2 text-[.95rem] leading-snug text-[color:var(--texto-2)]">
          Lo que el sistema le manda a cada cliente por WhatsApp: la confirmación al reservar, el recordatorio un día antes y los avisos de cambios.
        </p>
        <dl className="mt-5 grid grid-cols-2 gap-3">
          <div><dt className="etq !text-[.68rem]">Por salir</dt><dd className="font-rotulo text-[1.6rem] italic">{enCola ?? 0}</dd></div>
          <div><dt className="etq !text-[.68rem]">Próximas 24 h</dt><dd className="font-rotulo text-[1.6rem] italic">{proximas24 ?? 0}</dd></div>
        </dl>
        <EnviarAhora slug={slug} pendientes={yaTocan ?? 0} />
        <nav className="mt-5 grid gap-1" aria-label="Filtro">
          {FILTROS.map(f => (
            <Link key={f.id} href={`?ver=${f.id}`} aria-current={f.id === filtro ? 'page' : undefined}
              className="rounded-xl px-3 py-2 text-[.95rem] font-medium"
              style={f.id === filtro ? { background: 'rgb(var(--vidrio) / .18)', boxShadow: 'inset 0 0 0 1px var(--acento)' } : undefined}>
              {f.texto}
            </Link>
          ))}
        </nav>
        <p className="mt-5 text-[.82rem] leading-snug text-[color:var(--texto-2)]">Un proceso programado los manda cuando les toca. En la demo el canal es simulado: no sale nada a WhatsApp, pero se ve qué recibiría el cliente.</p>
      </aside>

      <section className="grid content-start gap-2.5" aria-label="Lista de mensajes">
        {(mensajes ?? []).map(x => (
          <article key={x.id} className="vidrio grid gap-2 p-4 sm:grid-cols-[9rem_1fr]">
            <div className="text-[.85rem]">
              <p className="font-medium">{TIPOS[x.tipo] ?? x.tipo}</p>
              <p className="tabular-nums text-[color:var(--texto-2)]">{x.destino}</p>
              <p className="mt-1 tabular-nums text-[color:var(--texto-2)]">
                {x.estado === 'enviado' && x.enviado_en ? `Salió ${cuando(x.enviado_en)}` : `Sale ${cuando(x.programado_para)}`}
              </p>
            </div>
            {/* Globo de WhatsApp: el texto tal como lo vería el cliente */}
            <p className="relative max-w-[60ch] justify-self-start rounded-2xl rounded-tl-sm px-4 py-2.5 text-[.95rem] leading-snug"
              style={{ background: x.estado === 'enviado' ? 'color-mix(in srgb, var(--acento) 18%, transparent)' : 'rgb(var(--vidrio) / .1)', boxShadow: 'inset 0 0 0 1px var(--linea)' }}>
              {x.cuerpo}
              <span className="mt-1 block text-right text-[.75rem] text-[color:var(--texto-2)]">{x.estado === 'enviado' ? '✓✓' : x.estado === 'fallido' ? 'No salió' : x.estado === 'enviando' ? 'Saliendo…' : 'En cola'}</span>
            </p>
          </article>
        ))}
        {!mensajes?.length && <div className="vidrio p-8 text-center text-[color:var(--texto-2)]">No hay mensajes en esta lista.</div>}
      </section>
    </div>
  );
}
