import { redirect } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isFounderEmail } from '@/config/founders';
import type { AdminUser } from '@/types/database';
import AdminSidebar from '@/components/admin/AdminSidebar';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Check admin_users table
  const { data: rawAdminUser } = await supabase
    .from('admin_users')
    .select('*')
    .eq('user_id', user.id)
    .single();

  let adminUser = rawAdminUser as unknown as AdminUser | null;

  // Auto-provision admin access for founder emails
  if (!adminUser && user.email && isFounderEmail(user.email)) {
    const adminSupabase = createAdminClient();
    const { data: newAdmin } = await adminSupabase
      .from('admin_users')
      .upsert({
        user_id: user.id,
        email: user.email,
        name: null,
        is_super_admin: true,
      }, { onConflict: 'user_id' })
      .select()
      .single();
    adminUser = newAdmin as unknown as AdminUser | null;
    if (adminUser) {
      console.log(`[admin] Auto-provisioned admin access for founder: ${user.email}`);
    }
  }

  if (!adminUser) {
    redirect('/');
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#0c1220]">
      <AdminSidebar
        userEmail={user.email ?? ''}
        isSuperAdmin={adminUser.is_super_admin}
      />

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-[#0f1621]">
        {children}
      </main>
    </div>
  );
}
