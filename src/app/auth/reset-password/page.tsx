'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Button from '@/components/ui/Button';

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase is not configured.');
      }

      const supabase = createBrowserClient(supabaseUrl, supabaseKey);

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/update-password`,
      });

      if (resetError) throw resetError;

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center mx-auto mb-4">
            <svg className="w-6 h-6 text-navy-deep" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="font-display text-3xl text-cream mb-3">Check Your Email</h1>
          <p className="text-cream/50 text-sm mb-8">
            If an account exists for <span className="text-cream/70 font-medium">{email}</span>,
            you&apos;ll receive a password reset link shortly.
          </p>
          <a href="/login" className="text-gold hover:text-gold-light transition-colors text-sm font-medium">
            Back to Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pattern flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-10">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center mx-auto mb-4">
            <span className="text-navy-deep font-bold text-xl">R</span>
          </div>
          <h1 className="font-display text-3xl text-cream mb-2">Reset Password</h1>
          <p className="text-cream/50 text-sm">Enter your email and we&apos;ll send a reset link.</p>
        </div>

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

          <Button type="submit" size="lg" fullWidth loading={loading}>
            Send Reset Link
          </Button>
        </form>

        <p className="text-center mt-6 text-sm text-cream/40">
          Remember your password?{' '}
          <a href="/login" className="text-gold hover:text-gold-light transition-colors font-medium">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
