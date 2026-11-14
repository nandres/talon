'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'motion/react';
import { consultarHorarios, reservar } from './acciones';
import { duracion, fechaLarga, guaranies, hora, numeroTalon } from '@/lib/formato';
import { partesLocales } from '@/lib/tiempo';
import type { DiaDisponible, Negocio, Oferta, Profesional, Servicio, Talon } from '@/lib/tipos';
import { SUAVE } from '../animaciones';
import TalonVaho from '../TalonVaho';
import BotonPagar from '../turno/[codigo]/BotonPagar';

type Props = { negocio: Negocio; servicios: Servicio[]; profesionales: Profesional[]; ofertas: Oferta[] };
type Turno = DiaDisponible['turnos'][number];

const CUALQUIERA = 'cualquiera';
const RESORTE = { type: 'spring', stiffness: 400, damping: 36 } as const;

const entrar = {
  oculto: { opacity: 0, y: 18, filter: 'blur(8px)' },
  visible: (i: number = 0) => ({ opacity: 1, y: 0, filter: 'blur(0px)', transition: { duration: 0.7, delay: 0.07 * i, ease: SUAVE } }),
};

export default function Reserva({ negocio, servicios, profesionales, ofertas }: Props) {
  const zona = negocio.zona_horaria;
  const quieto = useReducedMotion();
  const [servicioId, setServicioId] = useState<string | null>(null);
  const [profesional, setProfesional] = useState<string>(CUALQUIERA);
  const [dias, setDias] = useState<DiaDisponible[] | null>(null);
  const [fecha, setFecha] = useState<string | null>(null);
  const [turno, setTurno] = useState<Turno | null>(null);
  const [errorHorarios, setErrorHorarios] = useState<string | null>(null);
  const [cargando, iniciarCarga] = useTransition();
  const [enviando, iniciarEnvio] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [talon, setTalon] = useState<Talon | null>(null);
  const refCuando = useRef<HTMLElement>(null);
  const refDatos = useRef<HTMLElement>(null);

  const servicio = servicios.find(s => s.id === servicioId) ?? null;
  const nombres = useMemo(() => Object.fromEntries(profesionales.map(p => [p.id, p.nombre])), [profesionales]);
  const disponibles = useMemo(
    () => profesionales.filter(p => ofertas.some(o => o.servicio_id === servicioId && o.profesional_id === p.id)),
    [profesionales, ofertas, servicioId],
  );
  const sena = servicio && negocio.sena_porcentaje > 0 ? Math.round(servicio.precio_gs * negocio.sena_porcentaje / 100 / 1000) * 1000 : 0;

  function cargarHorarios(sId: string, prof: string, conservar?: string | null) {
    setTurno(null);
    setErrorHorarios(null);
    iniciarCarga(async () => {
      const r = await consultarHorarios(negocio.slug, sId, prof === CUALQUIERA ? null : prof);
      if (!r.ok) { setDias(null); setErrorHorarios(r.error); return; }
      setDias(r.datos);
      const mantener = conservar && r.datos.find(d => d.fecha === conservar && d.turnos.length);
      setFecha(mantener ? conservar : (r.datos.find(d => d.turnos.length)?.fecha ?? null));
    });
  }

  function elegirServicio(id: string) {
    setServicioId(id);
    const sigue = profesional === CUALQUIERA || ofertas.some(o => o.servicio_id === id && o.profesional_id === profesional);
    const prof = sigue ? profesional : CUALQUIERA;
    setProfesional(prof);
    cargarHorarios(id, prof, fecha);
  }

  function elegirProfesional(id: string) {
    setProfesional(id);
    if (servicioId) cargarHorarios(servicioId, id, fecha);
  }

  function elegirTurno(t: Turno) {
    setTurno(t);
    setError(null);
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => refDatos.current?.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'start' }));
    }
  }

  function enviar(form: FormData) {
    if (!servicioId || !turno) return;
    setError(null);
    iniciarEnvio(async () => {
      const r = await reservar({
        slug: negocio.slug,
        servicioId,
        profesionales: turno.profesionales,
        inicio: turno.inicio,
        nombre: String(form.get('nombre') ?? ''),
        telefono: String(form.get('telefono') ?? ''),
        correo: String(form.get('correo') ?? ''),
      });
      if (r.ok) { setTalon(r.datos); return; }
      setError(r.error);
      if (/horario/i.test(r.error)) cargarHorarios(servicioId, profesional, fecha);
    });
  }

  const diaElegido = dias?.find(d => d.fecha === fecha) ?? null;
  const conQuien = turno ? (profesional === CUALQUIERA && turno.profesionales.length > 1 ? 'Quien esté libre' : nombres[turno.profesionales[0]]) : null;

  return (
    <AnimatePresence mode="wait">
      {talon && servicio ? (
        <Comprobante key="listo" talon={talon} negocio={negocio} servicio={servicio} profesional={nombres[talon.profesionalId]} />
      ) : (
        <motion.div key="reserva" className="grid gap-5 lg:grid-cols-[1.15fr_.85fr]" exit={{ opacity: 0, y: -16, filter: 'blur(10px)', transition: { duration: 0.35 } }}>
          <div className="grid content-start gap-5">
            {/* Servicio */}
            <motion.section className="vidrio p-2" aria-labelledby="t-servicio" initial="oculto" animate="visible" variants={entrar} custom={10}>
              <h2 id="t-servicio" className="etq px-4 pb-1 pt-3">Servicio</h2>
              <LayoutGroup id="servicio">
                <div role="radiogroup" aria-labelledby="t-servicio">
                  {servicios.map(s => {
                    const activo = s.id === servicioId;
                    return (
                      <button key={s.id} type="button" role="radio" aria-checked={activo} onClick={() => elegirServicio(s.id)}
                        className="relative grid w-full grid-cols-[1fr_auto] items-baseline gap-4 rounded-[16px] px-4 py-4 text-left">
                        {activo && (
                          <motion.span layoutId="marca-servicio" transition={RESORTE} className="absolute inset-0 rounded-[16px]"
                            style={{ background: 'rgb(var(--vidrio) / .16)', boxShadow: 'inset 0 0 0 1px var(--acento)' }} />
                        )}
                        <span className="relative">
                          <span className="block text-[1.12rem] font-medium">{s.nombre}</span>
                          <span className="block text-[.9rem] text-[color:var(--texto-2)]">
                            {duracion(s.duracion_min)}{s.descripcion ? ` · ${s.descripcion.replace(/\.$/, '')}` : ''}
                          </span>
                        </span>
                        <span className="relative text-[1.05rem] tabular-nums">{guaranies(s.precio_gs)}</span>
                      </button>
                    );
                  })}
                </div>
              </LayoutGroup>
            </motion.section>

            {/* Profesional */}
            <motion.section className="vidrio p-4" aria-labelledby="t-quien" style={{ ['--retraso' as string]: '1.5s' }}
              initial="oculto" animate="visible" variants={entrar} custom={12}>
              <h2 id="t-quien" className="etq pb-3">Con quién</h2>
              {!servicio && <p className="text-[.95rem] text-[color:var(--texto-2)]">Primero elegí un servicio.</p>}
              {servicio && (
                <LayoutGroup id="quien">
                  <div role="radiogroup" aria-labelledby="t-quien" className="flex flex-wrap gap-2">
                    {[{ id: CUALQUIERA, nombre: 'Quien esté libre' }, ...disponibles].map(p => {
                      const activo = p.id === profesional;
                      return (
                        <button key={p.id} type="button" role="radio" aria-checked={activo} onClick={() => elegirProfesional(p.id)}
                          className="relative flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 text-[.95rem]">
                          {activo && <motion.span layoutId="marca-quien" transition={RESORTE} className="absolute inset-0 rounded-full" style={{ background: 'var(--acento)' }} />}
                          <span aria-hidden className="relative grid size-8 place-items-center rounded-full text-[.78rem] font-semibold"
                            style={{ background: 'rgb(var(--vidrio) / .22)', boxShadow: 'inset 0 0 0 1px var(--linea)', color: activo ? 'var(--acento-tinta)' : undefined }}>
                            {p.id === CUALQUIERA ? '✱' : iniciales(p.nombre)}
                          </span>
                          <span className="relative font-medium" style={{ color: activo ? 'var(--acento-tinta)' : undefined }}>{p.nombre}</span>
                        </button>
                      );
                    })}
                  </div>
                </LayoutGroup>
              )}
            </motion.section>

            {/* Día y hora */}
            <motion.section ref={refCuando} className="vidrio p-4" aria-labelledby="t-cuando" aria-busy={cargando}
              style={{ ['--retraso' as string]: '3s' }} initial="oculto" animate="visible" variants={entrar} custom={14}>
              <h2 id="t-cuando" className="etq pb-3">Cuándo</h2>
              {errorHorarios && <Aviso>{errorHorarios}</Aviso>}
              {!servicio && <p className="text-[.95rem] text-[color:var(--texto-2)]">Elegí un servicio para ver los horarios libres.</p>}
              {servicio && (
                <>
                  <TiraDeDias dias={dias} fecha={fecha} zona={zona} cargando={cargando} onElegir={f => { setFecha(f); setTurno(null); }} />
                  {diaElegido && diaElegido.turnos.length > 0 && (
                    <Horarios key={`${fecha}-${servicioId}-${profesional}`} turnos={diaElegido.turnos} zona={zona} elegido={turno?.inicio ?? null} onElegir={elegirTurno} atenuado={cargando} />
                  )}
                  {dias && !dias.some(d => d.turnos.length) && !cargando && (
                    <Aviso>No quedan horarios libres en los próximos {negocio.ventana_dias} días. Probá con otro profesional.</Aviso>
                  )}
                </>
              )}
            </motion.section>
          </div>

          {/* Resumen y datos */}
          <motion.section ref={refDatos} aria-labelledby="t-datos" className="vidrio vidrio-oscuro h-fit p-5 lg:sticky lg:top-6"
            style={{ ['--retraso' as string]: '4.5s' }} initial="oculto" animate="visible" variants={entrar} custom={16}>
            <h2 id="t-datos" className="etq">Tu turno</h2>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div key={`${servicioId}-${turno?.inicio}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.25 }}>
                <p className="mt-3 font-rotulo text-[1.75rem] italic leading-tight">{servicio?.nombre ?? 'Elegí un servicio'}</p>
                <p className="mt-1 text-[.95rem] text-[color:var(--texto-2)] first-letter:uppercase">
                  {turno ? `${fechaLarga(turno.inicio, zona)} · ${hora(turno.inicio, zona)} · ${conQuien}` : servicio ? 'Elegí día y hora' : '—'}
                </p>
              </motion.div>
            </AnimatePresence>
            <div className="filete my-5" />
            <form action={enviar} className="grid gap-3">
              <fieldset disabled={!turno || enviando} className="grid gap-3 disabled:opacity-60">
                <label className="sr-only" htmlFor="nombre">Nombre y apellido</label>
                <input id="nombre" name="nombre" className="campo" placeholder="Nombre y apellido" autoComplete="name" required minLength={2} maxLength={80} />
                <label className="sr-only" htmlFor="telefono">Celular (WhatsApp)</label>
                <input id="telefono" name="telefono" className="campo" placeholder="Celular (WhatsApp)" autoComplete="tel" inputMode="tel" required pattern="[\d\s\(\)\+\.\-]{7,20}" />
                <label className="sr-only" htmlFor="correo">Correo (opcional)</label>
                <input id="correo" name="correo" className="campo" placeholder="Correo (opcional)" autoComplete="email" type="email" maxLength={120} />
              </fieldset>
              {servicio && (
                <div className="mt-1 grid gap-1 text-[.95rem]">
                  <p className="flex justify-between text-[color:var(--texto-2)]"><span>Total</span><span className="tabular-nums">{guaranies(servicio.precio_gs)}</span></p>
                  {sena > 0 && <p className="flex justify-between font-medium"><span>Seña {negocio.sena_porcentaje} % para reservar</span><span className="tabular-nums">{guaranies(sena)}</span></p>}
                </div>
              )}
              {error && <Aviso>{error}</Aviso>}
              <motion.button type="submit" disabled={!turno || enviando} whileHover={turno ? { y: -1 } : undefined} whileTap={turno ? { scale: 0.98 } : undefined}
                className="mt-2 w-full rounded-[14px] py-3.5 text-[1.02rem] font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                style={{ background: 'var(--acento)', color: 'var(--acento-tinta)' }}>
                {enviando ? 'Reservando…' : 'Reservar'}
              </motion.button>
            </form>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Piezas ──────────────────────────────────────────────────────────────────

function iniciales(nombre: string) {
  return nombre.replace(/^Lic\.\s*/, '').split(' ').map(p => p[0]).slice(0, 2).join('');
}

function Aviso({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="mt-3 rounded-[14px] px-4 py-3 text-[.95rem]"
      style={{ background: 'rgb(var(--vidrio) / .12)', boxShadow: 'inset 0 0 0 1px var(--aviso)', color: 'var(--aviso)' }}>
      {children}
    </p>
  );
}

function TiraDeDias({ dias, fecha, zona, cargando, onElegir }: { dias: DiaDisponible[] | null; fecha: string | null; zona: string; cargando: boolean; onElegir: (f: string) => void }) {
  if (!dias) {
    return (
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: 8 }, (_, i) => <div key={i} className="h-[4.6rem] w-14 shrink-0 animate-pulse rounded-2xl" style={{ background: 'rgb(var(--vidrio) / .12)' }} />)}
      </div>
    );
  }
  const hoy = partesLocales(new Date(), zona).fecha;
  return (
    <LayoutGroup id="dias">
      <div role="radiogroup" aria-label="Día" className="-mx-4 flex snap-x gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {dias.map(d => {
          const f = new Date(`${d.fecha}T12:00:00Z`);
          const libres = d.turnos.length;
          const activo = d.fecha === fecha;
          const semana = new Intl.DateTimeFormat('es-PY', { weekday: 'short', timeZone: 'UTC' }).format(f).replace('.', '');
          return (
            <button key={d.fecha} type="button" role="radio" aria-checked={activo} disabled={!libres || cargando} onClick={() => onElegir(d.fecha)}
              aria-label={`${fechaLarga(f, 'UTC')}: ${libres ? `${libres} horarios libres` : 'sin horarios'}`}
              className="relative flex w-14 shrink-0 snap-start flex-col items-center rounded-2xl py-2 disabled:opacity-30">
              {activo && <motion.span layoutId="marca-dia" transition={RESORTE} className="absolute inset-0 rounded-2xl" style={{ background: 'rgb(var(--vidrio) / .2)', boxShadow: 'inset 0 0 0 1px var(--acento)' }} />}
              <span className="etq relative !text-[.68rem] !tracking-[.1em]">{d.fecha === hoy ? 'hoy' : semana}</span>
              <span className="relative font-rotulo text-[1.6rem] italic leading-tight">{Number(d.fecha.slice(8))}</span>
              <span aria-hidden className="relative mt-0.5 h-1 w-1 rounded-full" style={{ background: libres ? 'var(--acento)' : 'transparent' }} />
            </button>
          );
        })}
      </div>
    </LayoutGroup>
  );
}

function Horarios({ turnos, zona, elegido, onElegir, atenuado }: { turnos: Turno[]; zona: string; elegido: string | null; onElegir: (t: Turno) => void; atenuado: boolean }) {
  const grupos = [
    { nombre: 'Mañana', desde: 0, hasta: 12 * 60 },
    { nombre: 'Tarde', desde: 12 * 60, hasta: 18 * 60 },
    { nombre: 'Noche', desde: 18 * 60, hasta: 24 * 60 },
  ].map(g => ({ ...g, turnos: turnos.filter(t => { const m = partesLocales(new Date(t.inicio), zona).minutosDelDia; return m >= g.desde && m < g.hasta; }) }))
    .filter(g => g.turnos.length);

  let n = 0;
  return (
    <motion.div className={`mt-4 space-y-4 transition-opacity ${atenuado ? 'opacity-40' : ''}`} initial="oculto" animate="visible">
      {grupos.map(g => (
        <div key={g.nombre}>
          <p className="etq mb-2">{g.nombre}</p>
          <div role="radiogroup" aria-label={g.nombre} className="grid grid-cols-[repeat(auto-fill,minmax(4.6rem,1fr))] gap-1.5">
            {g.turnos.map(t => {
              const activo = t.inicio === elegido;
              return (
                <motion.button key={t.inicio} type="button" role="radio" aria-checked={activo} onClick={() => onElegir(t)}
                  variants={entrar} custom={(n++) * 0.35} whileTap={{ scale: 0.94 }}
                  className="relative rounded-xl py-2 text-[1rem] font-medium tabular-nums">
                  <span aria-hidden className="absolute inset-0 rounded-xl transition-colors"
                    style={{ background: activo ? 'var(--acento)' : 'rgb(var(--vidrio) / .1)', boxShadow: 'inset 0 0 0 1px var(--linea)' }} />
                  <span className="relative" style={{ color: activo ? 'var(--acento-tinta)' : undefined }}>{hora(t.inicio, zona)}</span>
                </motion.button>
              );
            })}
          </div>
        </div>
      ))}
    </motion.div>
  );
}

function Comprobante({ talon, negocio, servicio, profesional }: { talon: Talon; negocio: Negocio; servicio: Servicio; profesional: string }) {
  const zona = negocio.zona_horaria;
  const pendiente = talon.estado === 'pendiente_pago';
  return (
    <TalonVaho numero={numeroTalon(talon.numero)}>
      <p className="mt-6 text-[1.15rem] font-medium">{servicio.nombre} · {profesional}</p>
      <p className="mt-1 text-[color:var(--texto-2)] first-letter:uppercase">{fechaLarga(talon.inicio, zona)} · {hora(talon.inicio, zona)} a {hora(talon.fin, zona)}</p>
      <p className="mt-4 text-[.95rem]">Código <span className="font-semibold tracking-[.12em]">{talon.codigo}</span></p>
      <div className="filete mx-auto my-5 max-w-xs" />
      {pendiente ? (
        <>
          <p className="mx-auto max-w-[40ch] text-[.95rem] leading-relaxed text-[color:var(--texto-2)]">
            Te guardamos el horario 15 minutos. Pagá la seña de <strong className="text-[color:var(--texto)]">{guaranies(talon.senaGs)}</strong> para confirmarlo; si no, se libera.
          </p>
          <BotonPagar codigo={talon.codigo} montoGs={talon.senaGs} />
        </>
      ) : (
        <p className="mx-auto max-w-[40ch] text-[.95rem] leading-relaxed text-[color:var(--texto-2)]">Quedó confirmado. Te mandamos la confirmación por WhatsApp y un recordatorio el día anterior.</p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[.95rem] font-medium">
        <a href={`/turno/${talon.codigo}`} className="text-[color:var(--acento)] underline decoration-1 underline-offset-4">Guardar el enlace de mi turno</a>
        <button type="button" onClick={() => location.reload()} className="text-[color:var(--texto-2)] underline decoration-1 underline-offset-4">Sacar otro turno</button>
      </div>
    </TalonVaho>
  );
}
