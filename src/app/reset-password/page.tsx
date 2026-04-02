'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Button from '@/components/ui/Button';

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  useEffect(() => {
    // Supabase automatically picks up the recovery token from the URL hash
    // when the client is initialized. We just need to wait for the session.
    if (!supabaseUrl || !supabaseKey) return;

    const supabase = createBrowserClient(supabaseUrl, supabaseKey);
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setReady(true);
      }
    });
  }, [supabaseUrl, supabaseKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase is not configured.');
      }

      const supabase = createBrowserClient(supabaseUrl, supabaseKey);

      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        throw updateError;
      }

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update password. Please try again.');
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
          <h1 className="font-display text-3xl text-cream mb-2">Set New Password</h1>
          <p className="text-cream/50 text-sm">Enter your new password below.</p>
        </div>

        <form onSubmit={handleSubmit} className="card-premium rounded-xl p-8 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-900/20 border border-red-500/20 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {!ready && (
            <div className="rounded-lg bg-gold/10 border border-gold/20 p-3 text-sm text-gold/80">
              Verifying your reset link...
            </div>
          )}

          <div>
            <label htmlFor="new-password" className="block text-sm font-medium text-cream/80 mb-2">
              New Password
            </label>
            <input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              className="w-full rounded-lg border border-gold/20 bg-navy-deep/60 px-4 py-3 text-cream placeholder:text-cream/30 focus:border-gold focus:ring-2 focus:ring-gold/15 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label htmlFor="confirm-password" className="block text-sm font-medium text-cream/80 mb-2">
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm your password"
              required
              minLength={8}
              className="w-full rounded-lg border border-gold/20 bg-navy-deep/60 px-4 py-3 text-cream placeholder:text-cream/30 focus:border-gold focus:ring-2 focus:ring-gold/15 focus:outline-none transition-all"
            />
          </div>

          <Button type="submit" size="lg" fullWidth loading={loading} disabled={!ready}>
            Update Password
          </Button>
        </form>

        <p className="text-center mt-6 text-sm text-cream/40">
          <a href="/login" className="text-gold hover:text-gold-light transition-colors font-medium">
            Back to sign in
          </a>
        </p>
      </div>
    </div>
  );
}
