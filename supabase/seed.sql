-- ============================================================================
-- Supabase Seed Data
-- Runs automatically after migrations during `supabase db reset`
-- ============================================================================

-- ── Create founder auth user ────────────────────────────────────────────────
-- Password: Resourceful2026!
-- Uses only the core columns that exist in ALL GoTrue versions.
-- Supabase auto-fills any additional columns with defaults.
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'mikelaurenzo7@gmail.com',
  '$2b$10$0ZBQOYL508IRA6Spb60A0.pM3.oukC3XPNKnzMRdv3K0vyQsRFdcO',
  now(),
  '{"provider":"email","providers":["email"]}',
  '{"full_name":"Mike Laurenzo"}',
  'authenticated',
  'authenticated',
  now(),
  now()
) ON CONFLICT (id) DO NOTHING;

-- Identity record (required for email/password login)
INSERT INTO auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
) VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  jsonb_build_object('sub', 'a0000000-0000-0000-0000-000000000001', 'email', 'mikelaurenzo7@gmail.com', 'email_verified', true, 'phone_verified', false),
  'email',
  'a0000000-0000-0000-0000-000000000001',
  now(),
  now(),
  now()
) ON CONFLICT (provider, provider_id) DO NOTHING;

-- ── Create user profile ────────────────────────────────────────────────────
INSERT INTO public.users (id, full_name, phone)
VALUES ('a0000000-0000-0000-0000-000000000001', 'Mike Laurenzo', NULL)
ON CONFLICT (id) DO NOTHING;

-- ── Grant admin + super_admin ──────────────────────────────────────────────
INSERT INTO public.admin_users (user_id, email, name, is_super_admin)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'mikelaurenzo7@gmail.com',
  'Mike Laurenzo',
  true
) ON CONFLICT (user_id) DO NOTHING;
