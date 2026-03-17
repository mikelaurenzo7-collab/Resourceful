'use client';

import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  icon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, icon, className = '', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-cream/80 mb-2">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-cream/40">
              {icon}
            </div>
          )}
          <input
            ref={ref}
            className={`
              w-full rounded-lg border border-gold/20 bg-navy-deep/60
              px-4 py-3 text-cream placeholder:text-cream/30
              transition-all duration-200
              focus:border-gold focus:ring-2 focus:ring-gold/15 focus:outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
              ${icon ? 'pl-12' : ''}
              ${error ? 'border-red-500/50 focus:border-red-500 focus:ring-red-500/15' : ''}
              ${className}
            `}
            {...props}
          />
        </div>
        {error && <p className="mt-1.5 text-sm text-red-400">{error}</p>}
        {hint && !error && <p className="mt-1.5 text-sm text-cream/40">{hint}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
export default Input;
