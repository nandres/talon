// Pruebas contra Supabase local (npx supabase start). Si no hay base, se saltean.
// Verifican lo que no se puede probar en memoria: la RLS, la restricción de solapamiento
// y que dos reservas simultáneas del mismo horario no pasen las dos.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { turnosLibres, type Franja } from '../lib/disponibilidad.ts';
import { partesLocales, sumarDias } from '../lib/tiempo.ts';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54421';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
const disponible = ANON !== '' && await fetch(`${URL}/rest/v1/`, { headers: { apikey: ANON } }).then(r => r.ok, () => false);
if (process.env.CI && !disponible) throw new Error('En CI la base tiene que estar levantada: no se saltean estas pruebas.');
const opciones = { skip: disponible ? false : 'Supabase local no está corriendo' };

const anon = createClient(URL, ANON, { auth: { persistSession: false } });
const ZONA = 'America/Asuncion';
const SLUG = 'la-navaja';
const RAMON = '11111111-0000-4000-8000-0000000000a1';
const CORTE = '11111111-0000-4000-8000-0000000000c1';

/** Busca el primer horario libre de Ramón para un corte, a partir de pasado mañana. */
async function primerLibre(saltear = 0): Promise<Date[]> {
  const { data: franjas } = await anon.from('horarios').select('profesional_id, dia_semana, desde, hasta').eq('profesional_id', RAMON);
  const hoy = partesLocales(new Date(), ZONA).fecha;
  for (let i = 2 + saltear; i < 20; i++) {
    const fecha = sumarDias(hoy, i);
    const { data: ocupados } = await anon.rpc('agenda_ocupada', {
      p_slug: SLUG, p_desde: new Date(Date.now()).toISOString(), p_hasta: new Date(Date.now() + 25 * 864e5).toISOString(),
    });
    const libres = turnosLibres({
      fecha, zona: ZONA, profesionales: [RAMON],
      franjas: (franjas ?? []).map((f): Franja => ({ profesionalId: f.profesional_id, diaSemana: f.dia_semana, desde: f.desde.slice(0, 5), hasta: f.hasta.slice(0, 5) })),
      ocupados: (ocupados ?? []).map((o: { profesional_id: string; inicio: string; fin: string }) => ({ profesionalId: o.profesional_id, inicio: new Date(o.inicio), fin: new Date(o.fin) })),
      duracionMin: 30, intervaloMin: 15, ahora: new Date(), anticipacionMin: 60, ventanaDias: 21,
    });
    if (libres.length) return libres.map(l => l.inicio);
  }
  throw new Error('No hay horarios libres en el seed');
}

const reservar = (inicio: Date, telefono: string) => anon.rpc('reservar_turno', {
  p_slug: SLUG, p_servicio: CORTE, p_profesional: RAMON, p_inicio: inicio.toISOString(),
  p_nombre: 'Prueba Automática', p_telefono: telefono,
});

test('el público no puede leer reservas, clientes ni mensajes', opciones, async () => {
  for (const tabla of ['reservas', 'clientes', 'mensajes', 'pagos', 'miembros']) {
    const { data, error } = await anon.from(tabla).select('*').limit(5);
    assert.equal(error, null, tabla);
    assert.deepEqual(data, [], `${tabla} debería verse vacía para anon`);
  }
});

test('el público no puede insertar reservas directo en la tabla', opciones, async () => {
  const { error } = await anon.from('reservas').insert({ negocio_id: '11111111-0000-4000-8000-000000000001' });
  assert.notEqual(error, null);
});

test('el público no puede llamar las funciones internas ni las del panel', opciones, async () => {
  const id = '00000000-0000-4000-8000-000000000000';
  const llamadas = [
    anon.rpc('encolar_avisos', { p_reserva: id }),
    anon.rpc('cambiar_estado_reserva', { p_reserva: id, p_estado: 'cancelada' }),
    anon.rpc('reprogramar_reserva', { p_reserva: id, p_inicio: new Date().toISOString(), p_profesional: id }),
    anon.rpc('guardar_horarios', { p_profesional: id, p_franjas: [] }),
    anon.rpc('restaurar_demo'),
    anon.rpc('tomar_mensajes', { p_limite: 1 }),
  ];
  for (const r of await Promise.all(llamadas)) assert.equal(r.error?.code, '42501', 'permiso denegado');
});

test('agenda_ocupada no expone datos personales', opciones, async () => {
  const { data, error } = await anon.rpc('agenda_ocupada', { p_slug: SLUG, p_desde: new Date().toISOString(), p_hasta: new Date(Date.now() + 7 * 864e5).toISOString() });
  assert.equal(error, null);
  assert.ok(data.length > 0);
  assert.deepEqual(Object.keys(data[0]).sort(), ['fin', 'inicio', 'profesional_id']);
});

test('reservar un horario libre funciona y el mismo horario después falla con TAL05', opciones, async () => {
  const [inicio] = await primerLibre();
  const primero = await reservar(inicio, '0981999001');
  assert.equal(primero.error, null, primero.error?.message);
  assert.equal(primero.data[0].estado, 'confirmada');
  assert.match(primero.data[0].codigo, /^[0-9A-F]{8}$/);

  const segundo = await reservar(inicio, '0981999002');
  assert.equal(segundo.error?.code, 'TAL05');
});

test('dos reservas simultáneas del mismo horario: entra una sola', opciones, async () => {
  const [inicio] = await primerLibre(1);
  const resultados = await Promise.all(Array.from({ length: 6 }, (_, i) => reservar(inicio, `098199910${i}`)));
  const ok = resultados.filter(r => !r.error);
  assert.equal(ok.length, 1, 'exactamente una reserva debe entrar');
  assert.ok(resultados.filter(r => r.error).every(r => r.error!.code === 'TAL05'));
});

test('rechaza horarios desalineados, fuera de atención o con datos inválidos', opciones, async () => {
  const [inicio] = await primerLibre(2);
  const desalineado = new Date(inicio.getTime() + 7 * 60_000);
  assert.equal((await reservar(desalineado, '0981999200')).error?.code, 'TAL02');

  const lunes = new Date(inicio);
  while (partesLocales(lunes, ZONA).diaSemana !== 1) lunes.setTime(lunes.getTime() + 864e5);
  assert.equal((await reservar(lunes, '0981999201')).error?.code, 'TAL04');

  assert.equal((await reservar(inicio, 'abc')).error?.code, 'TAL03');
});
