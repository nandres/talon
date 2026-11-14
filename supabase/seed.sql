-- Talón: datos de ejemplo. Todo es ficticio: negocios, personas y teléfonos.
-- Los negocios y sus turnos los crea public.restaurar_demo() (migración 6), que también corre
-- cada noche en la demo publicada. Acá solo se agregan las cuentas de la demo.
-- ── Cuentas de demostración ────────────────────────────────────────────────
-- Contraseña común: talon-demo-2026 (datos ficticios; la usa el botón "Entrar como…").

do $$
declare
  u record;
begin
  for u in select * from (values
    ('aaaaaaaa-0000-4000-8000-000000000001'::uuid, 'ramon@lanavaja.demo', '11111111-0000-4000-8000-000000000001'::uuid, 'dueno'),
    ('aaaaaaaa-0000-4000-8000-000000000002'::uuid, 'tati@lanavaja.demo',  '11111111-0000-4000-8000-000000000001'::uuid, 'personal'),
    ('aaaaaaaa-0000-4000-8000-000000000003'::uuid, 'paula@kine.demo',     '22222222-0000-4000-8000-000000000002'::uuid, 'dueno')
  ) t(id, correo, negocio, rol) loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.correo,
            extensions.crypt('talon-demo-2026', extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text, jsonb_build_object('sub', u.id::text, 'email', u.correo, 'email_verified', true),
            'email', now(), now(), now());
  end loop;
end $$;

select public.restaurar_demo();
