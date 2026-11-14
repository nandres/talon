export type Negocio = {
  id: string;
  slug: string;
  nombre: string;
  rubro: string;
  direccion: string | null;
  telefono: string | null;
  zona_horaria: string;
  sena_porcentaje: number;
  anticipacion_min: number;
  ventana_dias: number;
  intervalo_min: number;
  ultimo_numero: number;
  foto: string | null;
  tema: 'noche' | 'dia';
  lema: string | null;
};

export type Servicio = { id: string; nombre: string; descripcion: string | null; duracion_min: number; precio_gs: number };
export type Profesional = { id: string; nombre: string; especialidad: string | null };
export type Oferta = { profesional_id: string; servicio_id: string };

export type DiaDisponible = { fecha: string; turnos: { inicio: string; profesionales: string[] }[] };

export type Talon = {
  codigo: string;
  numero: number;
  estado: 'confirmada' | 'pendiente_pago';
  senaGs: number;
  inicio: string;
  fin: string;
  profesionalId: string;
};
