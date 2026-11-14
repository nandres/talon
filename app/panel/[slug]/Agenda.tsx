'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { accionesPara, ESTADOS, PAGOS, type BloqueoPanel, type EstadoReserva, type FranjaPanel, type ReservaPanel } from '@/lib/agenda';
import { diaSemana, horaAMinutos, partesLocales, sumarDias } from '@/lib/tiempo';
import { fechaLarga, guaranies, hora, numeroTalon } from '@/lib/formato';
import type { DiaDisponible } from '@/lib/tipos';
import { cambiarEstado, huecosParaMover, mover } from './acciones';
import { SUAVE } from '../../animaciones';

type Props = {
  slug: string;
  zona: string;
  hoy: string;
  fecha: string;
  vista: 'dia' | 'semana';
  dias: string[];
  profesionales: { id: string; nombre: string }[];
  ofertas: { profesional_id: string; servicio_id: string }[];
  franjas: FranjaPanel[];
  bloqueos: BloqueoPanel[];
  reservas: ReservaPanel[];
};

const PX = 1.5; // píxeles por minuto en la vista del día

export default function Agenda(p: Props) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [verCanceladas, setVerCanceladas] = useState(false);
  const [filtro, setFiltro] = useState<string>('todos');
  const nombres = useMemo(() => Object.fromEntries(p.profesionales.map(x => [x.id, x.nombre])), [p.profesionales]);
  const visibles = p.reservas.filter(r => (verCanceladas || r.estado !== 'cancelada') && (filtro === 'todos' || r.profesionalId === filtro));
  const reserva = p.reservas.find(r => r.id === abierta) ?? null;

  return (
    <div className="grid gap-5">
      <Encabezado {...p} visibles={visibles} verCanceladas={verCanceladas} setVerCanceladas={setVerCanceladas} filtro={filtro} setFiltro={setFiltro} />
      {p.vista === 'dia'
        ? <VistaDia {...p} reservas={visibles} nombres={nombres} filtro={filtro} onAbrir={setAbierta} />
        : <VistaSemana {...p} reservas={visibles} nombres={nombres} onAbrir={setAbierta} />}
      <AnimatePresence>
        {reserva && <Ficha key={reserva.id} slug={p.slug} zona={p.zona} reserva={reserva} nombres={nombres} ofertas={p.ofertas} onCerrar={() => setAbierta(null)} />}
      </AnimatePresence>
    </div>
  );
}

// ── Encabezado: navegación de fechas, vista y números del período ───────────

function Encabezado({ slug, hoy, fecha, vista, dias, profesionales, visibles, verCanceladas, setVerCanceladas, filtro, setFiltro }: Props & {
  visibles: ReservaPanel[]; verCanceladas: boolean; setVerCanceladas: (v: boolean) => void; filtro: string; setFiltro: (v: string) => void;
}) {
  const paso = vista === 'semana' ? 7 : 1;
  const url = (f: string, v = vista) => `/panel/${slug}?fecha=${f}&vista=${v}`;
  const activas = visibles.filter(r => r.estado !== 'cancelada');
  const ingresos = activas.filter(r => r.estado === 'confirmada' || r.estado === 'completada').reduce((s, r) => s + r.precioGs, 0);
  const pendientes = activas.filter(r => r.estado === 'pendiente_pago').length;
  const ausentes = activas.filter(r => r.estado === 'ausente').length;
  const titulo = vista === 'dia'
    ? fechaLarga(`${fecha}T12:00:00Z`, 'UTC')
    : `Semana del ${Number(dias[0].slice(8))} al ${fechaLarga(`${dias[6]}T12:00:00Z`, 'UTC').replace(/^\S+,\s*/, '')}`;

  return (
    <section className="vidrio grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-end" style={{ ['--retraso' as string]: '3s' }}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={url(sumarDias(fecha, -paso))} aria-label="Anterior" className="grid size-9 place-items-center rounded-full" style={{ boxShadow: 'inset 0 0 0 1px var(--linea)' }}>←</Link>
          <Link href={url(hoy)} className="rounded-full px-3.5 py-1.5 text-[.9rem] font-medium" style={{ boxShadow: 'inset 0 0 0 1px var(--linea)' }}>Hoy</Link>
          <Link href={url(sumarDias(fecha, paso))} aria-label="Siguiente" className="grid size-9 place-items-center rounded-full" style={{ boxShadow: 'inset 0 0 0 1px var(--linea)' }}>→</Link>
          <div className="ml-1 flex rounded-full p-1" style={{ boxShadow: 'inset 0 0 0 1px var(--linea)' }}>
            {(['dia', 'semana'] as const).map(v => (
              <Link key={v} href={url(fecha, v)} aria-current={v === vista ? 'page' : undefined} className="relative rounded-full px-3.5 py-1 text-[.88rem] font-medium">
                {v === vista && <motion.span layoutId="vista" className="absolute inset-0 rounded-full" style={{ background: 'rgb(var(--vidrio) / .22)' }} />}
                <span className="relative">{v === 'dia' ? 'Día' : 'Semana'}</span>
              </Link>
            ))}
          </div>
        </div>
        <h1 className="mt-4 font-rotulo text-[clamp(1.8rem,4vw,2.6rem)] italic leading-tight first-letter:uppercase">
          {titulo}{fecha === hoy && vista === 'dia' ? <span className="etq ml-3 align-middle not-italic">hoy</span> : null}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-[.9rem]">
          <label className="flex items-center gap-2">
            <span className="text-[color:var(--texto-2)]">Profesional</span>
            <select value={filtro} onChange={e => setFiltro(e.target.value)} className="campo !w-auto !py-1.5 !pr-8">
              <option value="todos">Todos</option>
              {profesionales.map(x => <option key={x.id} value={x.id}>{x.nombre}</option>)}
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[color:var(--texto-2)]">
            <input type="checkbox" checked={verCanceladas} onChange={e => setVerCanceladas(e.target.checked)} className="size-4 accent-[color:var(--acento)]" />
            Ver cancelados
          </label>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
        <Cifra titulo="Turnos" valor={String(activas.length)} />
        <Cifra titulo="Ingresos" valor={guaranies(ingresos)} />
        <Cifra titulo="Señas por cobrar" valor={String(pendientes)} />
        <Cifra titulo="No vinieron" valor={String(ausentes)} />
      </dl>
    </section>
  );
}

function Cifra({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <dt className="etq !text-[.68rem]">{titulo}</dt>
      <dd className="mt-0.5 font-rotulo text-[1.5rem] italic tabular-nums leading-tight">{valor}</dd>
    </div>
  );
}

// ── Vista del día: una columna por profesional, el tiempo hacia abajo ────────

function VistaDia({ zona, hoy, fecha, profesionales, franjas, bloqueos, reservas, nombres, filtro, onAbrir }: Props & { nombres: Record<string, string>; filtro: string; onAbrir: (id: string) => void }) {
  const dow = diaSemana(fecha);
  const columnas = profesionales.filter(x => filtro === 'todos' || x.id === filtro);
  const delDia = franjas.filter(f => f.diaSemana === dow);
  const desde = Math.floor(Math.min(...delDia.map(f => horaAMinutos(f.desde)), 9 * 60) / 60) * 60;
  const hasta = Math.ceil(Math.max(...delDia.map(f => horaAMinutos(f.hasta)), 19 * 60) / 60) * 60;
  const alto = (hasta - desde) * PX;
  const min = (iso: string) => partesLocales(new Date(iso), zona).minutosDelDia;
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    const tic = () => setAhora(partesLocales(new Date(), zona).minutosDelDia);
    tic();
    const t = setInterval(tic, 60_000);
    return () => clearInterval(t);
  }, [zona]);

  if (!columnas.length) return <Vacio>No hay profesionales activos.</Vacio>;

  return (
    <section className="vidrio overflow-x-auto p-4" aria-label="Agenda del día" style={{ ['--retraso' as string]: '5s' }}>
      <div className="grid min-w-fit" style={{ gridTemplateColumns: `3.5rem repeat(${columnas.length}, minmax(11rem, 1fr))` }}>
        <div />
        {columnas.map(c => (
          <div key={c.id} className="px-2 pb-3">
            <p className="font-medium">{c.nombre}</p>
            <p className="text-[.8rem] text-[color:var(--texto-2)]">
              {delDia.filter(f => f.profesionalId === c.id).map(f => `${f.desde}–${f.hasta}`).join(' · ') || 'No atiende'}
            </p>
          </div>
        ))}

        {/* Reglas de las horas */}
        <div className="relative" style={{ height: alto }}>
          {Array.from({ length: (hasta - desde) / 60 + 1 }, (_, i) => (
            <span key={i} className="absolute right-2 -translate-y-1/2 text-[.75rem] tabular-nums text-[color:var(--texto-2)]" style={{ top: i * 60 * PX }}>
              {String(desde / 60 + i).padStart(2, '0')}:00
            </span>
          ))}
        </div>

        {columnas.map(c => (
          <div key={c.id} className="relative mx-1" style={{ height: alto, backgroundImage: `repeating-linear-gradient(180deg, var(--linea-suave) 0 1px, transparent 1px ${60 * PX}px)` }}>
            {/* Horario de atención: lo que queda fuera se ve apagado */}
            {delDia.filter(f => f.profesionalId === c.id).map(f => (
              <div key={f.desde} className="absolute inset-x-0 rounded-xl" style={{ top: (horaAMinutos(f.desde) - desde) * PX, height: (horaAMinutos(f.hasta) - horaAMinutos(f.desde)) * PX, background: 'rgb(var(--vidrio) / .07)' }} />
            ))}
            {bloqueos.filter(b => !b.profesionalId || b.profesionalId === c.id).map((b, i) => {
              const a = Math.max(min(b.inicio), desde), z = partesLocales(new Date(b.fin), zona).fecha > fecha ? hasta : Math.min(min(b.fin), hasta);
              return (
                <div key={i} className="absolute inset-x-0 grid place-items-center rounded-xl text-[.8rem] text-[color:var(--texto-2)]"
                  style={{ top: (a - desde) * PX, height: Math.max(z - a, 0) * PX, background: 'repeating-linear-gradient(135deg, var(--linea-suave) 0 6px, transparent 6px 12px)' }}>
                  {b.motivo ?? 'Bloqueado'}
                </div>
              );
            })}
            {reservas.filter(r => r.profesionalId === c.id).map(r => {
              const a = min(r.inicio), z = min(r.fin);
              return (
                <motion.button key={r.id} type="button" onClick={() => onAbrir(r.id)} layout
                  initial={{ opacity: 0, scale: .96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: .35, ease: SUAVE }}
                  className="absolute inset-x-1 overflow-hidden rounded-xl px-2.5 py-1.5 text-left"
                  style={{ top: (a - desde) * PX + 1, height: Math.max((z - a) * PX - 2, 22), ...estiloBloque(r.estado) }}>
                  <span className="flex items-baseline justify-between gap-2 text-[.78rem] tabular-nums opacity-80">
                    <span>{hora(r.inicio, zona)}</span><span>N.º {numeroTalon(r.numero)}</span>
                  </span>
                  <span className={`block truncate text-[.92rem] font-medium leading-tight ${r.estado === 'cancelada' ? 'line-through' : ''}`}>{r.cliente}</span>
                  {(z - a) >= 30 && <span className="block truncate text-[.8rem] opacity-75">{r.servicio}</span>}
                </motion.button>
              );
            })}
            {fecha === hoy && ahora !== null && ahora >= desde && ahora <= hasta && (
              <div aria-hidden className="pointer-events-none absolute inset-x-0 z-10 h-px" style={{ top: (ahora - desde) * PX, background: 'var(--aviso)', boxShadow: '0 0 8px var(--aviso)' }}>
                <span className="absolute -left-1 -top-1 size-2 rounded-full" style={{ background: 'var(--aviso)' }} />
              </div>
            )}
          </div>
        ))}
      </div>
      {!reservas.length && <p className="mt-2 text-center text-[.95rem] text-[color:var(--texto-2)]">No hay turnos este día.</p>}
      <span className="sr-only">{Object.keys(nombres).length} profesionales</span>
    </section>
  );
}

function estiloBloque(estado: EstadoReserva): React.CSSProperties {
  switch (estado) {
    case 'confirmada': return { background: 'color-mix(in srgb, var(--acento) 26%, transparent)', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--acento) 80%, transparent)' };
    case 'pendiente_pago': return { background: 'rgb(var(--vidrio) / .1)', outline: '1.5px dashed var(--acento)', outlineOffset: -1.5 };
    case 'completada': return { background: 'rgb(var(--vidrio) / .1)', boxShadow: 'inset 0 0 0 1px var(--linea)', opacity: .75 };
    case 'ausente': return { background: 'color-mix(in srgb, var(--aviso) 14%, transparent)', boxShadow: 'inset 0 0 0 1px color-mix(in srgb, var(--aviso) 70%, transparent)' };
    default: return { background: 'transparent', boxShadow: 'inset 0 0 0 1px var(--linea)', opacity: .55 };
  }
}

// ── Vista de la semana: siete columnas con la lista de turnos ───────────────

function VistaSemana({ slug, zona, hoy, dias, reservas, nombres, onAbrir }: Props & { nombres: Record<string, string>; onAbrir: (id: string) => void }) {
  return (
    <section className="grid gap-3 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-7" aria-label="Agenda de la semana">
      {dias.map((d, i) => {
        const delDia = reservas.filter(r => partesLocales(new Date(r.inicio), zona).fecha === d);
        const f = new Date(`${d}T12:00:00Z`);
        return (
          <div key={d} className="vidrio flex min-h-40 flex-col p-2.5" style={{ ['--retraso' as string]: `${i * .6}s` }}>
            <Link href={`/panel/${slug}?fecha=${d}&vista=dia`} className="flex items-baseline justify-between px-1.5 pb-2">
              <span className="etq !text-[.68rem]">{new Intl.DateTimeFormat('es-PY', { weekday: 'short', timeZone: 'UTC' }).format(f).replace('.', '')}</span>
              <span className={`font-rotulo text-[1.5rem] italic leading-none ${d === hoy ? 'text-[color:var(--acento)]' : ''}`}>{Number(d.slice(8))}</span>
            </Link>
            <div className="grid gap-1">
              {delDia.map(r => (
                <button key={r.id} type="button" onClick={() => onAbrir(r.id)} className="rounded-lg px-2 py-1 text-left text-[.8rem] leading-tight" style={estiloBloque(r.estado)}>
                  <span className="tabular-nums opacity-80">{hora(r.inicio, zona)}</span>{' '}
                  <span className={`font-medium ${r.estado === 'cancelada' ? 'line-through' : ''}`}>{r.cliente.split(' ')[0]}</span>
                  <span className="block truncate opacity-70">{nombres[r.profesionalId]?.split(' ')[0]} · {r.servicio}</span>
                </button>
              ))}
              {!delDia.length && <p className="px-1.5 text-[.8rem] text-[color:var(--texto-2)]">Sin turnos</p>}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function Vacio({ children }: { children: React.ReactNode }) {
  return <div className="vidrio p-8 text-center text-[color:var(--texto-2)]">{children}</div>;
}

// ── Ficha de un turno: datos del cliente y lo que se puede hacer ─────────────

function Ficha({ slug, zona, reserva: r, nombres, ofertas, onCerrar }: {
  slug: string; zona: string; reserva: ReservaPanel; nombres: Record<string, string>; ofertas: Props['ofertas']; onCerrar: () => void;
}) {
  const router = useRouter();
  const quieto = useReducedMotion();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [moviendo, setMoviendo] = useState(false);
  const yaEmpezo = Date.parse(r.inicio) <= Date.now();
  const acciones = accionesPara(r.estado, yaEmpezo);

  useEffect(() => {
    const tecla = (e: KeyboardEvent) => { if (e.key === 'Escape') onCerrar(); };
    window.addEventListener('keydown', tecla);
    return () => window.removeEventListener('keydown', tecla);
  }, [onCerrar]);

  function aplicar(estado: EstadoReserva) {
    setError(null);
    iniciar(async () => {
      const x = await cambiarEstado(slug, r.id, estado);
      if (!x.ok) { setError(x.error); return; }
      router.refresh();
    });
  }

  return (
    <>
      <motion.div className="fixed inset-0 z-40 bg-black/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onCerrar} aria-hidden />
      <motion.aside role="dialog" aria-modal="true" aria-label={`Turno N.º ${numeroTalon(r.numero)}`}
        className="vidrio vidrio-oscuro fixed inset-y-3 right-3 z-50 flex w-[min(27rem,calc(100vw-1.5rem))] flex-col overflow-y-auto p-6"
        style={{ background: 'rgb(var(--tinte) / .82)' }}
        initial={quieto ? false : { x: '105%' }} animate={{ x: 0 }} exit={{ x: '105%' }} transition={{ duration: .45, ease: SUAVE }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="etq">Turno N.º {numeroTalon(r.numero)} · {ESTADOS[r.estado].texto}</p>
            <h2 className="mt-2 font-rotulo text-[2rem] italic leading-tight">{r.cliente}</h2>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-9 shrink-0 place-items-center rounded-full text-[1.2rem]" style={{ boxShadow: 'inset 0 0 0 1px var(--linea)' }}>×</button>
        </div>

        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-[.95rem]">
          <dt className="text-[color:var(--texto-2)]">Servicio</dt><dd>{r.servicio}</dd>
          <dt className="text-[color:var(--texto-2)]">Con</dt><dd>{nombres[r.profesionalId]}</dd>
          <dt className="text-[color:var(--texto-2)]">Cuándo</dt><dd className="first-letter:uppercase">{fechaLarga(r.inicio, zona)}, {hora(r.inicio, zona)} a {hora(r.fin, zona)}</dd>
          <dt className="text-[color:var(--texto-2)]">Teléfono</dt>
          <dd><a className="underline decoration-1 underline-offset-4" href={`https://wa.me/${r.telefono.replace(/\D/g, '').replace(/^0/, '595')}`} target="_blank" rel="noreferrer">{r.telefono}</a></dd>
          {r.correo && <><dt className="text-[color:var(--texto-2)]">Correo</dt><dd className="break-all">{r.correo}</dd></>}
          <dt className="text-[color:var(--texto-2)]">Precio</dt><dd className="tabular-nums">{guaranies(r.precioGs)}{r.senaGs > 0 ? ` · seña ${guaranies(r.senaGs)}` : ''}</dd>
          {r.senaGs > 0 && (
            <><dt className="text-[color:var(--texto-2)]">Seña</dt>
            <dd style={r.pago === 'reintegrar' ? { color: 'var(--aviso)', fontWeight: 600 } : undefined}>{r.pago ? PAGOS[r.pago] : r.estado === 'pendiente_pago' ? 'todavía no abrió el pago' : 'cobrada en el local'}</dd></>
          )}
          <dt className="text-[color:var(--texto-2)]">Código</dt><dd className="font-semibold tracking-[.12em]">{r.codigo}</dd>
        </dl>
        {r.estado === 'pendiente_pago' && r.expiraEn && (
          <p className="mt-4 text-[.9rem] text-[color:var(--texto-2)]">La seña vence a las {hora(r.expiraEn, zona)}; si no se paga, el horario se libera solo.</p>
        )}

        <div className="filete my-6" />

        {acciones.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {acciones.map(a => (
              <button key={a.estado} type="button" disabled={pendiente} onClick={() => aplicar(a.estado)}
                className="rounded-full px-4 py-2 text-[.92rem] font-medium disabled:opacity-50"
                style={a.estado === 'cancelada'
                  ? { boxShadow: 'inset 0 0 0 1px var(--aviso)', color: 'var(--aviso)' }
                  : { background: 'var(--acento)', color: 'var(--acento-tinta)' }}>
                {a.texto}
              </button>
            ))}
            {(r.estado === 'confirmada' || r.estado === 'pendiente_pago') && (
              <button type="button" onClick={() => setMoviendo(v => !v)} aria-expanded={moviendo}
                className="rounded-full px-4 py-2 text-[.92rem] font-medium" style={{ boxShadow: 'inset 0 0 0 1px var(--linea)' }}>
                {moviendo ? 'No mover' : 'Mover turno'}
              </button>
            )}
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-[.92rem] text-[color:var(--aviso)]">{error}</p>}

        <AnimatePresence initial={false}>
          {moviendo && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: .35, ease: SUAVE }} className="overflow-hidden">
              <Mover slug={slug} zona={zona} reserva={r} nombres={nombres} ofertas={ofertas} onListo={() => { setMoviendo(false); router.refresh(); }} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>
    </>
  );
}

function Mover({ slug, zona, reserva: r, nombres, ofertas, onListo }: {
  slug: string; zona: string; reserva: ReservaPanel; nombres: Record<string, string>; ofertas: Props['ofertas']; onListo: () => void;
}) {
  const quienes = ofertas.filter(o => o.servicio_id === r.servicioId).map(o => o.profesional_id).filter(id => nombres[id]);
  const [prof, setProf] = useState<string>('todos');
  const [dias, setDias] = useState<DiaDisponible[] | null>(null);
  // Arranca en el día del turno: lo más común es correrlo un rato, no cambiarlo de semana.
  const [fecha, setFecha] = useState<string | null>(() => partesLocales(new Date(r.inicio), zona).fecha);
  const [error, setError] = useState<string | null>(null);
  const [cargando, iniciar] = useTransition();
  const [guardando, iniciarGuardado] = useTransition();

  useEffect(() => {
    iniciar(async () => {
      const x = await huecosParaMover(slug, r.id, prof === 'todos' ? null : prof);
      if (!x.ok) { setError(x.error); return; }
      setDias(x.datos);
      setFecha(f => (f && x.datos.find(d => d.fecha === f && d.turnos.length) ? f : x.datos.find(d => d.turnos.length)?.fecha ?? null));
    });
  }, [slug, r.id, prof]);

  function guardar(inicio: string, profesionales: string[]) {
    setError(null);
    const destino = profesionales.includes(r.profesionalId) ? r.profesionalId : profesionales[0];
    iniciarGuardado(async () => {
      const x = await mover(slug, r.id, inicio, destino);
      if (!x.ok) { setError(x.error); return; }
      onListo();
    });
  }

  const dia = dias?.find(d => d.fecha === fecha);
  return (
    <div className="mt-5 grid gap-3">
      <label className="grid gap-1.5 text-[.9rem]">
        <span className="text-[color:var(--texto-2)]">Con quién</span>
        <select value={prof} onChange={e => setProf(e.target.value)} className="campo !py-2">
          <option value="todos">Cualquiera que lo haga</option>
          {quienes.map(id => <option key={id} value={id}>{nombres[id]}</option>)}
        </select>
      </label>
      <div className={`flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] ${cargando ? 'opacity-50' : ''}`} role="radiogroup" aria-label="Día">
        {(dias ?? []).map(d => (
          <button key={d.fecha} type="button" role="radio" aria-checked={d.fecha === fecha} disabled={!d.turnos.length} onClick={() => setFecha(d.fecha)}
            className="flex w-12 shrink-0 flex-col items-center rounded-xl py-1.5 disabled:opacity-30"
            style={d.fecha === fecha ? { background: 'rgb(var(--vidrio) / .2)', boxShadow: 'inset 0 0 0 1px var(--acento)' } : undefined}>
            <span className="text-[.68rem] uppercase tracking-wider text-[color:var(--texto-2)]">{new Intl.DateTimeFormat('es-PY', { weekday: 'short', timeZone: 'UTC' }).format(new Date(`${d.fecha}T12:00:00Z`)).replace('.', '')}</span>
            <span className="font-rotulo text-[1.25rem] italic leading-tight">{Number(d.fecha.slice(8))}</span>
          </button>
        ))}
      </div>
      {dia && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(4.2rem,1fr))] gap-1.5">
          {dia.turnos.map(t => (
            <button key={t.inicio} type="button" disabled={guardando} onClick={() => guardar(t.inicio, t.profesionales)}
              className="rounded-lg py-1.5 text-[.92rem] font-medium tabular-nums disabled:opacity-50" style={{ background: 'rgb(var(--vidrio) / .1)', boxShadow: 'inset 0 0 0 1px var(--linea)' }}
              title={t.profesionales.map(x => nombres[x]).join(', ')}>
              {hora(t.inicio, zona)}
            </button>
          ))}
        </div>
      )}
      {dias && !dias.some(d => d.turnos.length) && <p className="text-[.9rem] text-[color:var(--texto-2)]">No hay huecos en las próximas tres semanas.</p>}
      <p className="text-[.82rem] text-[color:var(--texto-2)]">Tocá un horario para mover el turno. Al cliente le llega un aviso por WhatsApp.</p>
      {error && <p role="alert" className="text-[.92rem] text-[color:var(--aviso)]">{error}</p>}
    </div>
  );
}
