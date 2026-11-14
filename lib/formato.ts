const gs = new Intl.NumberFormat('es-PY', { maximumFractionDigits: 0 });

export const guaranies = (monto: number) => `Gs. ${gs.format(monto)}`;

export const numeroTalon = (n: number) => String(n).padStart(3, '0');

export function duracion(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60), m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function fechaLarga(instante: Date | string, zona: string): string {
  return new Intl.DateTimeFormat('es-PY', { weekday: 'long', day: 'numeric', month: 'long', timeZone: zona }).format(new Date(instante));
}

export function hora(instante: Date | string, zona: string): string {
  return new Intl.DateTimeFormat('es-PY', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zona }).format(new Date(instante));
}
