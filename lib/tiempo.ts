// Conversión entre hora local del negocio y UTC, sin dependencias.
// Usa la base de zonas de Intl, así que respeta cambios de huso como el de Paraguay
// (UTC-3 fijo desde octubre de 2024) sin tener que tocar el código.

const formatos = new Map<string, Intl.DateTimeFormat>();

function formato(zona: string): Intl.DateTimeFormat {
  let f = formatos.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: zona,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      weekday: 'short',
    });
    formatos.set(zona, f);
  }
  return f;
}

const DIAS: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export type PartesLocales = { fecha: string; hora: string; minutosDelDia: number; diaSemana: number };

/** Fecha y hora de pared en la zona dada. */
export function partesLocales(instante: Date, zona: string): PartesLocales {
  const p = Object.fromEntries(formato(zona).formatToParts(instante).map(x => [x.type, x.value]));
  const h = Number(p.hour), m = Number(p.minute);
  return {
    fecha: `${p.year}-${p.month}-${p.day}`,
    hora: `${p.hour}:${p.minute}`,
    minutosDelDia: h * 60 + m,
    diaSemana: DIAS[p.weekday],
  };
}

/** Desfase de la zona respecto de UTC en ese instante, en minutos (Asunción: -180). */
export function desfaseMinutos(instante: Date, zona: string): number {
  const p = Object.fromEntries(formato(zona).formatToParts(instante).map(x => [x.type, x.value]));
  const comoUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((comoUtc - Math.floor(instante.getTime() / 1000) * 1000) / 60000);
}

/** Instante UTC que corresponde a "fecha hora" en la zona del negocio. */
export function localAUtc(fecha: string, hora: string, zona: string): Date {
  const [y, mo, d] = fecha.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  const ingenuo = Date.UTC(y, mo - 1, d, h, mi);
  // Dos pasadas: la primera estima el desfase, la segunda corrige si cae cerca de un cambio de hora.
  let utc = ingenuo - desfaseMinutos(new Date(ingenuo), zona) * 60000;
  utc = ingenuo - desfaseMinutos(new Date(utc), zona) * 60000;
  return new Date(utc);
}

/** Día de la semana de una fecha de calendario (0 = domingo). */
export function diaSemana(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Suma días a una fecha de calendario 'AAAA-MM-DD'. */
export function sumarDias(fecha: string, dias: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + dias)).toISOString().slice(0, 10);
}

export function minutosAHora(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}

export function horaAMinutos(hora: string): number {
  const [h, m] = hora.split(':').map(Number);
  return h * 60 + m;
}
