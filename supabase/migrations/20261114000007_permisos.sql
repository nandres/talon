-- Talón: permisos de las funciones.
-- Supabase da EXECUTE a anon y authenticated sobre las funciones nuevas del esquema public
-- por privilegios por defecto; "revoke ... from public" no alcanza. Acá se deja explícito
-- quién puede llamar cada una (lo marcó el asesor de seguridad de Supabase).

-- Internas: solo las llaman otras funciones (que corren como dueño) o el servidor.
revoke execute on function public.encolar_avisos(uuid) from anon, authenticated;

-- Del panel: requieren sesión. Igual validan que quien llama sea del negocio.
revoke execute on function public.cambiar_estado_reserva(uuid, text) from anon;
revoke execute on function public.reprogramar_reserva(uuid, timestamptz, uuid) from anon;
revoke execute on function public.guardar_horarios(uuid, jsonb) from anon;

-- Quedan públicas a propósito:
--   agenda_ocupada, reservar_turno, turno_por_codigo: las usa la página de reserva.
--   es_miembro, es_dueno: las evalúan las políticas RLS también para anon (devuelven false).
