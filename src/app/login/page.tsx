'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Button from '@/components/ui/Button';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Validate redirect to prevent open redirect attacks — only allow relative paths
  const rawRedirect = searchParams.get('redirect') || '/dashboard';
  const redirect = rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') ? rawRedirect : '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) throw authError;

      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid email or password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-pattern flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center mx-auto mb-4">
            <span className="text-navy-deep font-bold text-xl">R</span>
          </div>
          <h1 className="font-display text-3xl text-cream mb-2">Welcome Back</h1>
          <p className="text-cream/50 text-sm">Sign in to access your reports and dashboard.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card-premium rounded-xl p-8 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-900/20 border border-red-500/20 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-cream/80 mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full rounded-lg border border-gold/20 bg-navy-deep/60 px-4 py-3 text-cream placeholder:text-cream/30 focus:border-gold focus:ring-2 focus:ring-gold/15 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-cream/80 mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              className="w-full rounded-lg border border-gold/20 bg-navy-deep/60 px-4 py-3 text-cream placeholder:text-cream/30 focus:border-gold focus:ring-2 focus:ring-gold/15 focus:outline-none transition-all"
            />
          </div>

          <Button type="submit" size="lg" fullWidth loading={loading}>
            Sign In
          </Button>
        </form>

        {/* Footer link */}
        <p className="text-center mt-6 text-sm text-cream/40">
          Don&apos;t have an account?{' '}
          <a href="/signup" className="text-gold hover:text-gold-light transition-colors font-medium">
            Create one
          </a>
        </p>
      </div>
    </div>
  );
}
