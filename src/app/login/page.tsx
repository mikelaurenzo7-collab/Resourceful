'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Button from '@/components/ui/Button';
import Wordmark from '@/components/ui/Wordmark';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase is not configured. Run the setup script first.');
      }

      const supabase = createBrowserClient(supabaseUrl, supabaseKey);

      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        // Translate common Supabase errors to user-friendly messages
        if (authError.message.includes('schema') || authError.message.includes('relation')) {
          console.error('[login] Database schema error:', authError.message);
          throw new Error('A temporary system error occurred. Please try again in a few minutes.');
        }
        throw authError;
      }

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
          <a href="/" className="inline-flex flex-col items-center gap-2 mb-6 hover:opacity-80 transition-opacity">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center">
              <span className="text-navy-deep font-bold text-xl">R</span>
            </div>
            <Wordmark className="font-display text-base text-cream/70 tracking-wide" />
          </a>
          <h1 className="font-display text-3xl text-cream mb-2">Welcome Back</h1>
          <p className="text-cream/50 text-sm">Sign in to access your reports and dashboard.</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card-premium rounded-xl p-8 space-y-6">
          {error && (
            <div role="alert" className="rounded-lg bg-red-900/20 border border-red-500/20 p-3 text-sm text-red-400">
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
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="password" className="block text-sm font-medium text-cream/80">
                Password
              </label>
              <a href="/auth/reset-password" className="text-xs text-gold/70 hover:text-gold transition-colors">
                Forgot password?
              </a>
            </div>
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-pattern flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
