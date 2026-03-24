'use client';

import React from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, helperText, type = 'text', ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-300 mb-1">
            {label}
          </label>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            'w-full px-3 py-2 bg-[#2d2d2d] border border-[#3d3d3d] rounded-md text-gray-200 placeholder-gray-500',
            'focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:border-transparent',
            'transition-colors duration-200',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            error && 'border-[#f44336] focus:ring-[#f44336]',
            className
          )}
          {...props}
        />
        {(error || helperText) && (
          <p className={cn('mt-1 text-xs', error ? 'text-[#f44336]' : 'text-gray-500')}>
            {error || helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
