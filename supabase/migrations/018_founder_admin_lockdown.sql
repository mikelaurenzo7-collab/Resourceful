-- ─── Migration 018: Founder Admin Lockdown ──────────────────────────────────
--
-- Ensures only the founder account (mikelaurenzo7@gmail.com) has admin access.
-- No admin link is visible in the UI — the admin panel is accessed directly
-- via /admin by the founder only.
--
-- The admin_users table controls who can access /admin routes.
-- The admin layout (app/admin/layout.tsx) checks this table server-side
-- and redirects non-admins to the homepage.

-- Remove any existing admin users that aren't the founder
-- (safety measure for clean slate)
DELETE FROM admin_users
WHERE email != 'mikelaurenzo7@gmail.com';

-- Ensure founder is an admin with super_admin privileges.
-- Uses ON CONFLICT to be idempotent — safe to run multiple times.
-- The user_id will be set once the founder creates their Supabase auth account.
-- For now, insert with a placeholder that the layout will match via email.
INSERT INTO admin_users (user_id, email, name, is_super_admin)
SELECT
  au.id,
  'mikelaurenzo7@gmail.com',
  'Mike Laurenzo',
  true
FROM auth.users au
WHERE au.email = 'mikelaurenzo7@gmail.com'
ON CONFLICT (email) DO UPDATE SET
  is_super_admin = true,
  user_id = EXCLUDED.user_id;

-- Add a unique constraint on email if it doesn't exist
-- (prevents duplicate admin entries for the same email)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'admin_users_email_unique'
  ) THEN
    ALTER TABLE admin_users ADD CONSTRAINT admin_users_email_unique UNIQUE (email);
  END IF;
END $$;
