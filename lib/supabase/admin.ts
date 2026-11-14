import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Cliente con la clave secreta: saltea la RLS. Solo para el webhook de pagos y el envío de
 * mensajes, que corren en el servidor y no tienen un usuario detrás.
 */
export function clienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Falta SUPABASE_SECRET_KEY en el servidor.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
