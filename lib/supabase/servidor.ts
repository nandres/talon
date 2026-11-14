import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';

const opcionesCookie = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/' };

/** Cliente con la sesión del usuario (cookies). La RLS decide qué ve. */
export async function clienteSesion() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const almacen = await cookies();
  return createServerClient(url, key, {
    cookieOptions: opcionesCookie,
    cookies: {
      getAll: () => almacen.getAll(),
      setAll(valores) {
        try {
          for (const { name, value, options } of valores) almacen.set(name, value, options);
        } catch {
          // En un Server Component no se pueden escribir cookies; proxy.ts ya refrescó la sesión.
        }
      },
    },
  });
}

export type Membresia = { negocio_id: string; rol: 'dueno' | 'personal'; negocios: { slug: string; nombre: string } };

/** Usuario actual y los negocios donde trabaja. Una consulta por pedido. */
export const sesionActual = cache(async () => {
  const db = await clienteSesion();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data } = await db.from('miembros').select('negocio_id, rol, negocios!inner(slug, nombre)').eq('usuario_id', user.id);
  return { db, usuario: user, membresias: (data ?? []) as unknown as Membresia[] };
});
