'use client';

import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, type = 'text', ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === 'password';

    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-300 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            type={isPassword && showPassword ? 'text' : type}
            ref={ref}
            className={cn(
              'w-full px-3 py-2 bg-[#2d2d2d] border border-[#3d3d3d] rounded-md text-gray-200 placeholder-gray-500',
              'focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:border-transparent',
              'transition-colors duration-200',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isPassword && 'pr-10',
              error && 'border-[#f44336] focus:ring-[#f44336]',
              className
            )}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>
        {(error || helperText) && (
          <p className={cn('mt-1 text-xs', error ? 'text-red-400' : 'text-gray-500')}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
