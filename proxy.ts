import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

// Refresca la sesión de Supabase antes de que el panel la lea.
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });
  respuesta.headers.set('Cache-Control', 'private, no-store');
  if (!request.cookies.getAll().some(c => c.name.startsWith('sb-'))) return respuesta;

  const db = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookieOptions: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(valores) {
        for (const { name, value } of valores) request.cookies.set(name, value);
        respuesta = NextResponse.next({ request });
        respuesta.headers.set('Cache-Control', 'private, no-store');
        for (const { name, value, options } of valores) respuesta.cookies.set(name, value, options);
      },
    },
  });
  await db.auth.getUser();
  return respuesta;
}

export const config = { matcher: ['/panel/:path*'] };
