'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { AnimatePresence, LayoutGroup, motion } from 'motion/react';
import { guardarHorarios, guardarProfesional, guardarServicio, type DatosProfesional, type DatosServicio, type Franja } from './acciones';
import { SUAVE } from '../../../animaciones';

type Props = {
  slug: string;
  servicios: DatosServicio[];
  profesionales: DatosProfesional[];
  horarios: { profesionalId: string; dia: number; desde: string; hasta: string }[];
};

const SECCIONES = [
  { id: 'servicios', texto: 'Servicios' },
  { id: 'equipo', texto: 'Equipo' },
  { id: 'horarios', texto: 'Horarios' },
] as const;
type Seccion = typeof SECCIONES[number]['id'];

const DIAS = [
  { n: 1, texto: 'Lunes' }, { n: 2, texto: 'Martes' }, { n: 3, texto: 'Miércoles' }, { n: 4, texto: 'Jueves' },
  { n: 5, texto: 'Viernes' }, { n: 6, texto: 'Sábado' }, { n: 0, texto: 'Domingo' },
];

const borde = { boxShadow: 'inset 0 0 0 1px var(--linea)' };

export default function Catalogo(p: Props) {
  const [seccion, setSeccion] = useState<Seccion>('servicios');
  return (
    <div className="grid gap-5">
      <section className="vidrio flex flex-wrap items-end justify-between gap-4 p-5">
        <div>
          <h1 className="font-rotulo text-[2rem] italic leading-tight">Catálogo</h1>
          <p className="mt-1 text-[.95rem] text-[color:var(--texto-2)]">Lo que ofrece el local, quién lo hace y cuándo atiende. Los cambios se ven al instante en la vidriera.</p>
        </div>
        <LayoutGroup id="secciones">
          <div role="tablist" className="flex rounded-full p-1" style={{ boxShadow: 'inset 0 0 0 1px var(--linea)' }}>
            {SECCIONES.map(s => (
              <button key={s.id} type="button" role="tab" aria-selected={s.id === seccion} onClick={() => setSeccion(s.id)} className="relative rounded-full px-4 py-1.5 text-[.92rem] font-medium">
                {s.id === seccion && <motion.span layoutId="seccion" className="absolute inset-0 rounded-full" style={{ background: 'var(--acento)' }} transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
                <span className="relative" style={{ color: s.id === seccion ? 'var(--acento-tinta)' : undefined }}>{s.texto}</span>
              </button>
            ))}
          </div>
        </LayoutGroup>
      </section>
      <AnimatePresence mode="wait">
        <motion.div key={seccion} role="tabpanel" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: .3, ease: SUAVE }}>
          {seccion === 'servicios' && <Servicios {...p} />}
          {seccion === 'equipo' && <Equipo {...p} />}
          {seccion === 'horarios' && <Horarios {...p} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ── Servicios ───────────────────────────────────────────────────────────────

function Servicios({ slug, servicios }: Props) {
  const [lista, setLista] = useState(servicios);
  return (
    <div className="grid gap-3">
      {lista.map((s, i) => <FilaServicio key={s.id ?? `nuevo-${i}`} slug={slug} inicial={s} onGuardado={id => setLista(l => l.map((x, j) => j === i ? { ...x, id } : x))} />)}
      <button type="button" onClick={() => setLista(l => [...l, { id: null, nombre: '', descripcion: '', duracionMin: 30, precioGs: 0, activo: true }])}
        className="vidrio justify-self-start px-5 py-3 text-[.95rem] font-medium">+ Agregar servicio</button>
    </div>
  );
}

function FilaServicio({ slug, inicial, onGuardado }: { slug: string; inicial: DatosServicio; onGuardado: (id: string) => void }) {
  const router = useRouter();
  const [s, setS] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const cambiado = JSON.stringify(s) !== JSON.stringify(guardado);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await guardarServicio(slug, s);
      if (!r.ok) { setError(r.error); return; }
      const nuevo = { ...s, id: r.id ?? s.id };
      setS(nuevo); setGuardado(nuevo); setOk(true); setTimeout(() => setOk(false), 1800);
      if (!s.id && r.id) onGuardado(r.id);
      router.refresh();
    });
  }

  return (
    <form onSubmit={guardar} className={`vidrio grid gap-3 p-4 md:grid-cols-[1.3fr_1.6fr_7rem_9rem_auto] md:items-end ${s.activo ? '' : 'opacity-70'}`}>
      <Campo etiqueta="Servicio"><input className="campo" value={s.nombre} required minLength={2} maxLength={80} onChange={e => setS({ ...s, nombre: e.target.value })} placeholder="Ej.: Corte clásico" /></Campo>
      <Campo etiqueta="Descripción"><input className="campo" value={s.descripcion} maxLength={200} onChange={e => setS({ ...s, descripcion: e.target.value })} placeholder="Opcional" /></Campo>
      <Campo etiqueta="Minutos">
        <select className="campo" value={s.duracionMin} onChange={e => setS({ ...s, duracionMin: Number(e.target.value) })}>
          {[10, 15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 120, 150, 180].concat(s.duracionMin).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b).map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      </Campo>
      <Campo etiqueta="Precio (Gs.)"><input className="campo tabular-nums" inputMode="numeric" value={s.precioGs ? new Intl.NumberFormat('es-PY').format(s.precioGs) : ''} onChange={e => setS({ ...s, precioGs: Number(e.target.value.replace(/\D/g, '')) || 0 })} placeholder="0" /></Campo>
      <div className="flex items-center gap-3">
        <Interruptor activo={s.activo} onCambio={v => setS({ ...s, activo: v })} texto={s.activo ? 'Activo' : 'Oculto'} />
        <BotonGuardar visible={cambiado || !s.id} pendiente={pendiente} ok={ok} />
      </div>
      {error && <p role="alert" className="text-[.9rem] text-[color:var(--aviso)] md:col-span-5">{error}</p>}
    </form>
  );
}

// ── Equipo ──────────────────────────────────────────────────────────────────

function Equipo({ slug, profesionales, servicios }: Props) {
  const [lista, setLista] = useState(profesionales);
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {lista.map((p, i) => <FichaProfesional key={p.id ?? `nuevo-${i}`} slug={slug} inicial={p} servicios={servicios} />)}
      <button type="button" onClick={() => setLista(l => [...l, { id: null, nombre: '', especialidad: '', activo: true, servicios: [] }])}
        className="vidrio min-h-24 px-5 py-3 text-[.95rem] font-medium">+ Agregar profesional</button>
    </div>
  );
}

function FichaProfesional({ slug, inicial, servicios }: { slug: string; inicial: DatosProfesional; servicios: DatosServicio[] }) {
  const router = useRouter();
  const [p, setP] = useState(inicial);
  const [guardado, setGuardado] = useState(inicial);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const cambiado = JSON.stringify(p) !== JSON.stringify(guardado);

  function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    iniciar(async () => {
      const r = await guardarProfesional(slug, p);
      if (!r.ok) { setError(r.error); return; }
      const nuevo = { ...p, id: r.id ?? p.id };
      setP(nuevo); setGuardado(nuevo); setOk(true); setTimeout(() => setOk(false), 1800);
      router.refresh();
    });
  }

  return (
    <form onSubmit={guardar} className={`vidrio grid content-start gap-3 p-4 ${p.activo ? '' : 'opacity-70'}`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre"><input className="campo" value={p.nombre} required minLength={2} maxLength={80} onChange={e => setP({ ...p, nombre: e.target.value })} /></Campo>
        <Campo etiqueta="Especialidad"><input className="campo" value={p.especialidad} maxLength={80} onChange={e => setP({ ...p, especialidad: e.target.value })} placeholder="Opcional" /></Campo>
      </div>
      <fieldset>
        <legend className="etq mb-2 !text-[.68rem]">Qué hace</legend>
        <div className="flex flex-wrap gap-1.5">
          {servicios.filter(s => s.id).map(s => {
            const tiene = p.servicios.includes(s.id!);
            return (
              <button key={s.id} type="button" aria-pressed={tiene}
                onClick={() => setP({ ...p, servicios: tiene ? p.servicios.filter(x => x !== s.id) : [...p.servicios, s.id!] })}
                className="rounded-full px-3 py-1.5 text-[.88rem] font-medium transition-colors"
                style={tiene ? { background: 'var(--acento)', color: 'var(--acento-tinta)' } : borde}>
                {s.nombre}
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="flex items-center justify-between gap-3">
        <Interruptor activo={p.activo} onCambio={v => setP({ ...p, activo: v })} texto={p.activo ? 'Atiende' : 'No atiende'} />
        <BotonGuardar visible={cambiado || !p.id} pendiente={pendiente} ok={ok} />
      </div>
      {error && <p role="alert" className="text-[.9rem] text-[color:var(--aviso)]">{error}</p>}
    </form>
  );
}

// ── Horarios ────────────────────────────────────────────────────────────────

function Horarios({ slug, profesionales, horarios }: Props) {
  const router = useRouter();
  const conId = profesionales.filter(p => p.id);
  const [quien, setQuien] = useState(conId[0]?.id ?? null);
  const [porProf, setPorProf] = useState(() => {
    const m: Record<string, Franja[]> = {};
    for (const h of horarios) (m[h.profesionalId] ??= []).push({ dia: h.dia, desde: h.desde, hasta: h.hasta });
    return m;
  });
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pendiente, iniciar] = useTransition();
  const franjas = quien ? porProf[quien] ?? [] : [];
  const poner = (f: Franja[]) => quien && setPorProf(m => ({ ...m, [quien]: f }));

  function guardar() {
    if (!quien) return;
    setError(null);
    iniciar(async () => {
      const r = await guardarHorarios(slug, quien, franjas);
      if (!r.ok) { setError(r.error); return; }
      setOk(true); setTimeout(() => setOk(false), 1800);
      router.refresh();
    });
  }

  if (!quien) return <div className="vidrio p-8 text-center text-[color:var(--texto-2)]">Primero agregá a alguien del equipo.</div>;

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_1fr]">
      <div className="vidrio grid h-fit gap-1 p-2">
        {conId.map(p => (
          <button key={p.id} type="button" onClick={() => { setQuien(p.id); setError(null); }} aria-pressed={p.id === quien}
            className="rounded-xl px-3 py-2.5 text-left text-[.95rem] font-medium"
            style={p.id === quien ? { background: 'rgb(var(--vidrio) / .18)', boxShadow: 'inset 0 0 0 1px var(--acento)' } : undefined}>
            {p.nombre}
            <span className="block text-[.8rem] font-normal text-[color:var(--texto-2)]">{(porProf[p.id!] ?? []).length ? `${new Set((porProf[p.id!] ?? []).map(f => f.dia)).size} días por semana` : 'Sin horario'}</span>
          </button>
        ))}
      </div>
      <div className="vidrio p-4">
        <div className="grid gap-1">
          {DIAS.map(d => {
            const del = franjas.filter(f => f.dia === d.n);
            return (
              <div key={d.n} className="grid items-center gap-2 rounded-xl px-2 py-2 sm:grid-cols-[7rem_1fr_auto]" style={{ background: del.length ? 'rgb(var(--vidrio) / .06)' : undefined }}>
                <span className={`font-medium ${del.length ? '' : 'text-[color:var(--texto-2)]'}`}>{d.texto}</span>
                <div className="flex flex-wrap gap-2">
                  {!del.length && <span className="text-[.9rem] text-[color:var(--texto-2)]">Cerrado</span>}
                  {del.map(f => {
                    const idx = franjas.indexOf(f);
                    const cambiar = (campo: 'desde' | 'hasta', v: string) => poner(franjas.map((x, j) => j === idx ? { ...x, [campo]: v } : x));
                    return (
                      <span key={idx} className="flex items-center gap-1 rounded-full py-1 pl-2 pr-1" style={borde}>
                        <input type="time" step={900} value={f.desde} onChange={e => cambiar('desde', e.target.value)} aria-label={`${d.texto}, desde`} className="bg-transparent tabular-nums outline-none" />
                        <span className="text-[color:var(--texto-2)]">a</span>
                        <input type="time" step={900} value={f.hasta} onChange={e => cambiar('hasta', e.target.value)} aria-label={`${d.texto}, hasta`} className="bg-transparent tabular-nums outline-none" />
                        <button type="button" onClick={() => poner(franjas.filter((_, j) => j !== idx))} aria-label="Quitar franja" className="grid size-7 place-items-center rounded-full text-[color:var(--texto-2)] hover:text-[color:var(--aviso)]">×</button>
                      </span>
                    );
                  })}
                </div>
                <button type="button" onClick={() => poner([...franjas, del.length ? { dia: d.n, desde: '15:00', hasta: '19:00' } : { dia: d.n, desde: '09:00', hasta: '13:00' }])}
                  className="justify-self-start rounded-full px-3 py-1 text-[.85rem] text-[color:var(--texto-2)] hover:text-[color:var(--texto)]" style={borde}>+ franja</button>
              </div>
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button type="button" onClick={() => {
            const lunes = franjas.filter(f => f.dia === 1);
            if (lunes.length) poner([...franjas.filter(f => f.dia === 0), ...[1, 2, 3, 4, 5, 6].flatMap(dia => lunes.map(f => ({ ...f, dia })))]);
          }} className="rounded-full px-4 py-2 text-[.9rem]" style={borde}>Copiar el lunes a lunes–sábado</button>
          <button type="button" onClick={guardar} disabled={pendiente} className="rounded-full px-5 py-2 text-[.95rem] font-semibold disabled:opacity-50" style={{ background: 'var(--acento)', color: 'var(--acento-tinta)' }}>
            {pendiente ? 'Guardando…' : ok ? 'Guardado ✓' : 'Guardar horarios'}
          </button>
          {error && <p role="alert" className="text-[.9rem] text-[color:var(--aviso)]">{error}</p>}
        </div>
        <p className="mt-3 text-[.82rem] text-[color:var(--texto-2)]">Los turnos ya tomados no se tocan; el horario nuevo vale para las reservas que vengan.</p>
      </div>
    </div>
  );
}

// ── Piezas ──────────────────────────────────────────────────────────────────

function Campo({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return <label className="grid gap-1.5"><span className="etq !text-[.68rem]">{etiqueta}</span>{children}</label>;
}

function Interruptor({ activo, onCambio, texto }: { activo: boolean; onCambio: (v: boolean) => void; texto: string }) {
  return (
    <button type="button" role="switch" aria-checked={activo} onClick={() => onCambio(!activo)} className="flex items-center gap-2 text-[.88rem]">
      <span className="relative h-6 w-10 rounded-full transition-colors" style={{ background: activo ? 'var(--acento)' : 'rgb(var(--vidrio) / .2)' }}>
        <motion.span className="absolute top-1 size-4 rounded-full bg-white shadow" animate={{ left: activo ? 20 : 4 }} transition={{ type: 'spring', stiffness: 500, damping: 34 }} />
      </span>
      {texto}
    </button>
  );
}

function BotonGuardar({ visible, pendiente, ok }: { visible: boolean; pendiente: boolean; ok: boolean }) {
  return (
    <AnimatePresence mode="popLayout">
      {(visible || ok) && (
        <motion.button key={ok ? 'ok' : 'g'} type="submit" disabled={pendiente || ok} initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .9 }}
          className="rounded-full px-4 py-2 text-[.9rem] font-semibold disabled:opacity-70" style={{ background: 'var(--acento)', color: 'var(--acento-tinta)' }}>
          {pendiente ? 'Guardando…' : ok ? 'Guardado ✓' : 'Guardar'}
        </motion.button>
      )}
    </AnimatePresence>
  );
}
