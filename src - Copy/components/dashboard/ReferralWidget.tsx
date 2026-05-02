'use client';

import { useState, useCallback } from 'react';

interface ReferralWidgetProps {
  userEmail: string;
  userName: string | null;
  hasWonAppeal: boolean;
}

/**
 * Dashboard referral widget. Shows the user's referral code
 * (generated on first click) and lets them copy to clipboard.
 */
export default function ReferralWidget({ userEmail, userName, hasWonAppeal }: ReferralWidgetProps) {
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateCode = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/referral/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: userEmail, name: userName }),
      });
      if (!res.ok) throw new Error('Failed to generate code');
      const data = await res.json();
      setCode(data.code);
    } catch {
      setError('Could not generate code. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userEmail, userName]);

  const copyCode = useCallback(async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const el = document.createElement('textarea');
      el.value = code;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [code]);

  return (
    <div className="card-premium rounded-xl p-5 md:p-6" data-animate>
      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-xl bg-gold/[0.08] flex items-center justify-center flex-shrink-0">
          <svg className="w-5 h-5 text-gold/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-cream">Share &amp; Save</h3>
          <p className="text-xs text-cream/40 mt-0.5 leading-relaxed">
            {hasWonAppeal
              ? 'Won your appeal? Share your referral code — friends get 10% off, you earn $5 credit on your next report.'
              : 'Share your referral code with friends. They get 10% off their report, and you earn $5 credit toward your next one.'}
          </p>

          {code ? (
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 bg-navy-deep/60 border border-gold/15 rounded-lg px-3 py-2 text-center">
                <span className="font-mono text-sm font-bold text-gold tracking-wider">{code}</span>
              </div>
              <button
                onClick={copyCode}
                className="flex items-center gap-1.5 text-xs font-medium text-navy-deep bg-gradient-to-r from-gold-light via-gold to-gold-dark px-3.5 py-2 rounded-lg hover:brightness-110 transition-all flex-shrink-0"
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy
                  </>
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={generateCode}
              disabled={loading}
              className="mt-3 text-xs font-medium border border-gold/20 text-gold hover:border-gold/40 hover:bg-gold/[0.05] px-4 py-2 rounded-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Generating...' : 'Get My Referral Code'}
            </button>
          )}

          {error && (
            <p className="text-xs text-red-400/70 mt-2">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
