// Permisos del panel contra Supabase local: cada cuenta ve y toca solo lo suyo,
// y las funciones de la base respetan las reglas aunque se las llame sin la interfaz.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { leerRango } from '../lib/agenda.ts';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54421';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const disponible = ANON !== '' && await fetch(`${URL}/rest/v1/`, { headers: { apikey: ANON } }).then(r => r.ok, () => false);
if (process.env.CI && !disponible) throw new Error('En CI la base tiene que estar levantada: no se saltean estas pruebas.');
const opciones = { skip: disponible ? false : 'Supabase local no está corriendo' };

const NAVAJA = '11111111-0000-4000-8000-000000000001';
const KINE = '22222222-0000-4000-8000-000000000002';

async function como(correo: string): Promise<SupabaseClient> {
  const db = createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await db.auth.signInWithPassword({ email: correo, password: 'talon-demo-2026' });
  if (error) throw error;
  return db;
}

async function turnoFuturo(db: SupabaseClient, saltear = 0) {
  const { data } = await db.from('reservas').select('id, profesional_id, servicio_id, periodo, estado')
    .eq('negocio_id', NAVAJA).eq('estado', 'confirmada').gt('periodo', `[${new Date(Date.now() + 2 * 864e5).toISOString()},)`)
    .order('periodo').range(saltear, saltear);
  return data![0];
}

test('cada dueño ve solo las reservas de su negocio', opciones, async () => {
  const ramon = await como('ramon@lanavaja.demo');
  const paula = await como('paula@kine.demo');
  const a = await ramon.from('reservas').select('negocio_id').limit(500);
  const b = await paula.from('reservas').select('negocio_id').limit(500);
  assert.ok(a.data!.length > 0 && a.data!.every(r => r.negocio_id === NAVAJA));
  assert.ok(b.data!.length > 0 && b.data!.every(r => r.negocio_id === KINE));
  const clientesAjenos = await paula.from('clientes').select('id').eq('negocio_id', NAVAJA);
  assert.deepEqual(clientesAjenos.data, []);
});

test('nadie cambia el estado de un turno de otro negocio', opciones, async () => {
  const ramon = await como('ramon@lanavaja.demo');
  const paula = await como('paula@kine.demo');
  const t = await turnoFuturo(ramon);
  const { error } = await paula.rpc('cambiar_estado_reserva', { p_reserva: t.id, p_estado: 'cancelada' });
  assert.equal(error?.code, 'TAL01');
});

test('no se puede marcar "atendido" un turno que todavía no empezó', opciones, async () => {
  const ramon = await como('ramon@lanavaja.demo');
  const t = await turnoFuturo(ramon);
  const { error } = await ramon.rpc('cambiar_estado_reserva', { p_reserva: t.id, p_estado: 'completada' });
  assert.equal(error?.code, 'TAL06');
});

test('cancelar descarta el recordatorio pendiente y avisa al cliente', opciones, async () => {
  const tati = await como('tati@lanavaja.demo'); // el equipo también puede cancelar
  const t = await turnoFuturo(tati, 3);
  const { error } = await tati.rpc('cambiar_estado_reserva', { p_reserva: t.id, p_estado: 'cancelada' });
  assert.equal(error, null);
  const { data: msjs } = await tati.from('mensajes').select('tipo, estado').eq('reserva_id', t.id);
  assert.ok(msjs!.some(m => m.tipo === 'cancelacion'));
  assert.ok(!msjs!.some(m => m.tipo === 'recordatorio' && m.estado === 'en_cola'));
});

test('mover un turno encima de otro falla con TAL05', opciones, async () => {
  const ramon = await como('ramon@lanavaja.demo');
  const a = await turnoFuturo(ramon, 0);
  const { data: otros } = await ramon.from('reservas').select('id, profesional_id, servicio_id, periodo')
    .eq('negocio_id', NAVAJA).eq('estado', 'confirmada').eq('profesional_id', a.profesional_id).neq('id', a.id)
    .gt('periodo', `[${new Date(Date.now() + 2 * 864e5).toISOString()},)`).limit(1);
  const b = otros![0];
  // Se alinea a la grilla de 15 minutos hacia abajo: sigue pisando a b, pero no falla por desalineado.
  const inicioB = Date.parse(leerRango(b.periodo).inicio);
  const destino = new Date(inicioB - (inicioB % (15 * 60_000))).toISOString();
  const { error } = await ramon.rpc('reprogramar_reserva', { p_reserva: a.id, p_inicio: destino, p_profesional: b.profesional_id });
  assert.equal(error?.code, 'TAL05');
});

test('el equipo no edita el catálogo; el dueño sí', opciones, async () => {
  const tati = await como('tati@lanavaja.demo');
  const ramon = await como('ramon@lanavaja.demo');
  const servicio = '11111111-0000-4000-8000-0000000000c3';

  const intento = await tati.from('servicios').update({ precio_gs: 1 }).eq('id', servicio).select('id');
  assert.deepEqual(intento.data, [], 'la RLS no deja actualizar al equipo');
  const horarios = await tati.rpc('guardar_horarios', { p_profesional: '11111111-0000-4000-8000-0000000000a3', p_franjas: [] });
  assert.equal(horarios.error?.code, 'TAL01');

  const { data: antes } = await ramon.from('servicios').select('precio_gs').eq('id', servicio).single();
  const cambio = await ramon.from('servicios').update({ precio_gs: Number(antes!.precio_gs) }).eq('id', servicio).select('id');
  assert.equal(cambio.data?.length, 1);
});
