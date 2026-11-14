// Cálculo de turnos libres. Función pura: recibe el catálogo y lo ocupado, devuelve los huecos.
// La base vuelve a validar todo al reservar (reservar_turno); esto es para mostrar opciones.

import { diaSemana, horaAMinutos, localAUtc } from './tiempo.ts';

export type Franja = { profesionalId: string; diaSemana: number; desde: string; hasta: string };
export type Ocupado = { profesionalId: string; inicio: Date; fin: Date };
export type Turno = { profesionalId: string; inicio: Date; fin: Date };
export type TurnoUnido = { inicio: Date; fin: Date; profesionales: string[] };

export type ParametrosDisponibilidad = {
  fecha: string;              // 'AAAA-MM-DD' en hora local del negocio
  zona: string;
  profesionales: string[];    // los que ofrecen el servicio elegido
  franjas: Franja[];
  ocupados: Ocupado[];
  duracionMin: number;
  intervaloMin: number;
  ahora: Date;
  anticipacionMin: number;
  ventanaDias: number;
};

const MIN = 60_000;

export function turnosLibres(p: ParametrosDisponibilidad): Turno[] {
  const dia = diaSemana(p.fecha);
  const desdeCuando = p.ahora.getTime() + p.anticipacionMin * MIN;
  const hastaCuando = p.ahora.getTime() + p.ventanaDias * 24 * 60 * MIN;
  const elegidos = new Set(p.profesionales);
  const libres: Turno[] = [];

  for (const f of p.franjas) {
    if (f.diaSemana !== dia || !elegidos.has(f.profesionalId)) continue;

    const ocupados = p.ocupados.filter(o => o.profesionalId === f.profesionalId);
    // El primer turno arranca en el primer múltiplo del intervalo dentro de la franja.
    let minuto = Math.ceil(horaAMinutos(f.desde) / p.intervaloMin) * p.intervaloMin;
    const finFranja = horaAMinutos(f.hasta);

    for (; minuto + p.duracionMin <= finFranja; minuto += p.intervaloMin) {
      const inicio = localAUtc(p.fecha, aHora(minuto), p.zona);
      const fin = new Date(inicio.getTime() + p.duracionMin * MIN);
      if (inicio.getTime() < desdeCuando || inicio.getTime() > hastaCuando) continue;
      if (ocupados.some(o => o.inicio < fin && inicio < o.fin)) continue;
      libres.push({ profesionalId: f.profesionalId, inicio, fin });
    }
  }

  return libres.sort((a, b) => a.inicio.getTime() - b.inicio.getTime() || a.profesionalId.localeCompare(b.profesionalId));
}

/** Para "cualquier profesional": un turno por horario, con quiénes pueden atenderlo. */
export function unirPorHorario(turnos: Turno[]): TurnoUnido[] {
  const porInicio = new Map<number, TurnoUnido>();
  for (const t of turnos) {
    const clave = t.inicio.getTime();
    const existente = porInicio.get(clave);
    if (existente) existente.profesionales.push(t.profesionalId);
    else porInicio.set(clave, { inicio: t.inicio, fin: t.fin, profesionales: [t.profesionalId] });
  }
  return [...porInicio.values()].sort((a, b) => a.inicio.getTime() - b.inicio.getTime());
}

function aHora(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
}
