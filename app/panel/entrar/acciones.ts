'use server';

import { redirect } from 'next/navigation';
import { clienteSesion } from '@/lib/supabase/servidor';

// Cuentas de la demo: datos ficticios, la contraseña está en supabase/seed.sql.
const DEMO: Record<string, string> = {
  'la-navaja': 'ramon@lanavaja.demo',
  'la-navaja-personal': 'tati@lanavaja.demo',
  'kine-mburucuya': 'paula@kine.demo',
};
const CLAVE_DEMO = process.env.DEMO_CLAVE ?? 'talon-demo-2026';

export async function entrarDemo(cuenta: string) {
  const correo = DEMO[cuenta];
  if (!correo) return { error: 'Cuenta de demostración inexistente.' };
  const db = await clienteSesion();
  const { error } = await db.auth.signInWithPassword({ email: correo, password: CLAVE_DEMO });
  if (error) return { error: 'No se pudo entrar a la demo. ¿Está corriendo la base?' };
  redirect(`/panel/${cuenta.replace('-personal', '')}`);
}

export async function entrar(_: unknown, form: FormData) {
  const correo = String(form.get('correo') ?? '').trim().slice(0, 120);
  const clave = String(form.get('clave') ?? '').slice(0, 200);
  if (!correo || !clave) return { error: 'Completá correo y contraseña.' };
  const db = await clienteSesion();
  const { error } = await db.auth.signInWithPassword({ email: correo, password: clave });
  if (error) return { error: 'Correo o contraseña incorrectos.' };
  redirect('/panel');
}

export async function salir() {
  const db = await clienteSesion();
  await db.auth.signOut();
  redirect('/panel/entrar');
}
