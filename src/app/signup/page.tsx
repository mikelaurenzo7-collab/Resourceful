'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import Button from '@/components/ui/Button';
import Wordmark from '@/components/ui/Wordmark';

export default function SignupPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/dashboard`,
          data: {
            full_name: fullName,
            phone: phone || undefined,
          },
        },
      });

      if (authError) {
        if (authError.message.includes('already registered')) {
          throw new Error('An account with this email already exists. Try signing in instead.');
        }
        if (authError.message.includes('password')) {
          throw new Error('Password must be at least 8 characters.');
        }
        console.error('[signup] Auth error:', authError.message);
        throw new Error('Unable to create account. Please try again.');
      }

      // If email confirmation is required, Supabase returns a user but
      // session is null. Show confirmation message instead of redirecting.
      if (data.user && !data.session) {
        setSignupComplete(true);
        return;
      }

      // Session exists — user is logged in, redirect to start
      router.push('/start');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Email confirmation success screen
  if (signupComplete) {
    return (
      <div className="min-h-screen bg-pattern flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="font-display text-2xl text-cream mb-3">Check Your Email</h1>
          <p className="text-cream/50 mb-2">
            We sent a confirmation link to <strong className="text-cream/70">{email}</strong>.
          </p>
          <p className="text-cream/35 text-sm mb-8">
            Click the link in your email to activate your account, then sign in.
          </p>
          <a
            href="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-gold border border-gold/20 px-5 py-2.5 rounded-lg hover:bg-gold/10 transition-all"
          >
            Go to Sign In
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pattern flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-10">
          <a href="/" className="inline-flex flex-col items-center gap-2 mb-6 hover:opacity-80 transition-opacity">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-gold-light to-gold-dark flex items-center justify-center">
              <span className="text-navy-deep font-bold text-xl">R</span>
            </div>
            <Wordmark className="font-display text-base text-cream/70 tracking-wide" />
          </a>
          <h1 className="font-display text-3xl text-cream mb-2">Create Your Account</h1>
          <p className="text-cream/50 text-sm">
            Join thousands of property owners saving on their taxes.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card-premium rounded-xl p-8 space-y-5">
          {error && (
            <div role="alert" className="rounded-lg bg-red-900/20 border border-red-500/20 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-cream/80 mb-2">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              required
              className="w-full rounded-lg border border-gold/20 bg-navy-deep/60 px-4 py-3 text-cream placeholder:text-cream/30 focus:border-gold focus:ring-2 focus:ring-gold/15 focus:outline-none transition-all"
            />
          </div>

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
              autoComplete="email"
              className="w-full rounded-lg border border-gold/20 bg-navy-deep/60 px-4 py-3 text-cream placeholder:text-cream/30 focus:border-gold focus:ring-2 focus:ring-gold/15 focus:outline-none transition-all"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-cream/80 mb-2">
              Phone Number <span className="text-cream/30 font-normal">(optional)</span>
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 555-0100"
              pattern="[0-9\-\(\)\+\s]*"
              title="Phone number (digits, dashes, parentheses, spaces)"
              className="w-full rounded-lg border border-gold/20 bg-navy-deep/60 px-4 py-3 text-cream placeholder:text-cream/30 focus:border-gold focus:ring-2 focus:ring-gold/15 focus:outline-none transition-all"
            />
            <p className="mt-1.5 text-xs text-cream/25">
              Optional. We&apos;ll only use this to notify you when your report is ready.
            </p>
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
              placeholder="Minimum 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
              className="w-full rounded-lg border border-gold/20 bg-navy-deep/60 px-4 py-3 text-cream placeholder:text-cream/30 focus:border-gold focus:ring-2 focus:ring-gold/15 focus:outline-none transition-all"
            />
          </div>

          <Button type="submit" size="lg" fullWidth loading={loading}>
            Create Account
          </Button>

          <p className="text-xs text-cream/25 text-center leading-relaxed">
            By creating an account, you agree to our{' '}
            <a href="/terms" className="underline hover:text-cream/40">Terms of Service</a>
            {' '}and{' '}
            <a href="/privacy" className="underline hover:text-cream/40">Privacy Policy</a>.
          </p>
        </form>

        {/* Footer link */}
        <p className="text-center mt-6 text-sm text-cream/40">
          Already have an account?{' '}
          <a href="/login" className="text-gold hover:text-gold-light transition-colors font-medium">
            Sign in
          </a>
        </p>
      </div>
    </div>
  );
}
