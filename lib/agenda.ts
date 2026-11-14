// Tipos y utilidades de la agenda del panel.

export type EstadoReserva = 'pendiente_pago' | 'confirmada' | 'cancelada' | 'completada' | 'ausente';

export type ReservaPanel = {
  id: string;
  numero: number;
  codigo: string;
  estado: EstadoReserva;
  inicio: string;
  fin: string;
  precioGs: number;
  senaGs: number;
  expiraEn: string | null;
  profesionalId: string;
  servicioId: string;
  servicio: string;
  cliente: string;
  telefono: string;
  correo: string | null;
  pago: 'pendiente' | 'aprobado' | 'rechazado' | 'vencido' | 'reintegrar' | null;
};

export const PAGOS: Record<NonNullable<ReservaPanel['pago']>, string> = {
  pendiente: 'cobro abierto, sin pagar',
  aprobado: 'pagada en línea',
  rechazado: 'el pago fue rechazado',
  vencido: 'venció sin pagar',
  reintegrar: 'pagó tarde: hay que devolverla',
};

export type FranjaPanel = { profesionalId: string; diaSemana: number; desde: string; hasta: string };
export type BloqueoPanel = { profesionalId: string | null; inicio: string; fin: string; motivo: string | null };

/** PostgREST devuelve un tstzrange como texto: ["2026-11-14 12:00:00+00","2026-11-14 12:30:00+00") */
export function leerRango(rango: string): { inicio: string; fin: string } {
  // Postgres escribe el huso como "+00"; JavaScript necesita "+00:00".
  const iso = (s: string) => new Date(s.replace(/"/g, '').trim().replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')).toISOString();
  const [a, b] = rango.slice(1, -1).split(',');
  return { inicio: iso(a), fin: iso(b) };
}

export const ESTADOS: Record<EstadoReserva, { texto: string; corto: string }> = {
  pendiente_pago: { texto: 'Seña pendiente', corto: 'Seña' },
  confirmada: { texto: 'Confirmado', corto: 'OK' },
  completada: { texto: 'Atendido', corto: 'Hecho' },
  ausente: { texto: 'No vino', corto: 'Ausente' },
  cancelada: { texto: 'Cancelado', corto: 'Cancel.' },
};

/** Acciones que el equipo puede hacer según el estado (espeja cambiar_estado_reserva). */
export function accionesPara(estado: EstadoReserva, yaEmpezo: boolean): { estado: EstadoReserva; texto: string }[] {
  switch (estado) {
    case 'pendiente_pago': return [{ estado: 'confirmada', texto: 'Marcar seña pagada' }, { estado: 'cancelada', texto: 'Cancelar' }];
    case 'confirmada': return [
      ...(yaEmpezo ? [{ estado: 'completada' as const, texto: 'Atendido' }, { estado: 'ausente' as const, texto: 'No vino' }] : []),
      { estado: 'cancelada', texto: 'Cancelar turno' },
    ];
    case 'completada':
    case 'ausente': return [{ estado: 'confirmada', texto: 'Deshacer' }];
    default: return [];
  }
}

export const MENSAJES_ERROR: Record<string, string> = {
  TAL01: 'Ese turno o profesional ya no está disponible.',
  TAL02: 'Ese horario no es válido.',
  TAL04: 'Ese horario está fuera de la atención.',
  TAL05: 'Ese horario ya está tomado.',
  TAL06: 'Ese cambio no se puede hacer en este estado.',
};
