'use client';

import { useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import Button from '@/components/ui/Button';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
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

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login`,
      });

      if (resetError) {
        setError(resetError.message);
      } else {
        setSent(true);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center animate-fade-in">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="font-display text-2xl text-cream mb-3">Check Your Email</h1>
          <p className="text-cream/50 text-sm mb-6">
            If an account exists for <span className="text-cream font-medium">{email}</span>,
            we&apos;ve sent a password reset link.
          </p>
          <Link href="/login" className="text-sm text-gold hover:text-gold-light transition-colors">
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pattern flex items-center justify-center px-6">
      <div className="max-w-md w-full animate-fade-in">
        <div className="text-center mb-8">
          <Link href="/" className="font-display text-2xl text-gold">Resourceful</Link>
          <h1 className="font-display text-2xl text-cream mt-6 mb-2">Reset Your Password</h1>
          <p className="text-cream/50 text-sm">
            Enter your email and we&apos;ll send you a reset link.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="card-premium rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm text-cream/60 mb-1.5">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className="w-full rounded-lg bg-navy-light border border-gold/15 px-4 py-3 text-cream placeholder-cream/25 focus:outline-none focus:border-gold/40 focus:ring-1 focus:ring-gold/20"
            />
          </div>

          {error && (
            <div className="rounded-lg bg-red-900/20 border border-red-500/20 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" fullWidth loading={loading}>
            Send Reset Link
          </Button>
        </form>

        <p className="text-center text-sm text-cream/40 mt-6">
          Remember your password?{' '}
          <Link href="/login" className="text-gold hover:text-gold-light transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
