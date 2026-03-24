'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: Array<{ value: string; label: string; className?: string }>;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-300 mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            className={cn(
              'w-full px-3 py-2 bg-[#2d2d2d] border border-[#3d3d3d] rounded-md text-gray-200',
              'focus:outline-none focus:ring-2 focus:ring-[#ff6b35] focus:border-transparent',
              'transition-colors duration-200 appearance-none cursor-pointer',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              error && 'border-[#f44336] focus:ring-[#f44336]',
              className
            )}
            {...props}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value} className={option.className}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
        {error && (
          <p className="mt-1 text-xs text-[#f44336]">{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
