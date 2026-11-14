import { redirect } from 'next/navigation';
import { sesionActual } from '@/lib/supabase/servidor';

export default async function Panel() {
  const sesion = await sesionActual();
  if (!sesion) redirect('/panel/entrar');
  const primera = sesion.membresias[0];
  if (!primera) redirect('/panel/entrar');
  redirect(`/panel/${primera.negocios.slug}`);
}
