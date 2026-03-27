'use client';

import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  glow?: boolean;
  children: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'relative bg-gradient-to-r from-gold-light via-gold to-gold-dark text-navy-deep font-semibold shadow-gold hover:shadow-gold-lg hover:scale-[1.02] active:scale-[0.98]',
  secondary:
    'bg-transparent border border-gold/30 text-gold hover:bg-gold/10 hover:border-gold/60 hover:shadow-[0_0_20px_rgba(212,168,71,0.08)] active:scale-[0.98]',
  danger:
    'bg-red-900/30 border border-red-500/30 text-red-400 hover:bg-red-900/50 hover:border-red-500/50 active:scale-[0.98]',
  ghost:
    'bg-transparent text-cream/70 hover:text-cream hover:bg-white/5 active:scale-[0.98]',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-4 py-2 text-sm rounded-lg',
  md: 'px-6 py-3 text-base rounded-lg',
  lg: 'px-8 py-4 text-lg rounded-xl',
};

export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  glow = false,
  children,
  className = '',
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center font-sans
        transition-all duration-300 ease-out
        disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${fullWidth ? 'w-full' : ''}
        ${glow && variant === 'primary' ? 'btn-glow animate-glow' : ''}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <svg
          className="animate-spin -ml-1 mr-2 h-5 w-5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path
            className="opacity-80"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      ) : null}
      {children}
    </button>
  );
}
