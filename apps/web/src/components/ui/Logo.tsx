'use client';

import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', className = '' }) => {
  const sizes = {
    sm: 24,
    md: 32,
    lg: 48,
    xl: 64,
  };

  const s = sizes[size];

  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background circle */}
      <circle cx="32" cy="32" r="30" fill="#1e1e1e" stroke="#ff6b35" strokeWidth="2"/>
      
      {/* Runner figure - stylized R */}
      <path
        d="M20 44V20h8l8 12 8-12h8v24h-6V26l-8 12h-6l-8-12v18h-6z"
        fill="#ff6b35"
      />
      
      {/* Motion lines */}
      <path
        d="M14 28h4M14 32h6M14 36h4"
        stroke="#ff6b35"
        strokeWidth="2"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
};

interface LogoWithTextProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LogoWithText: React.FC<LogoWithTextProps> = ({ size = 'md', className = '' }) => {
  const logoSizes = {
    sm: 20,
    md: 28,
    lg: 40,
  };

  const textSizes = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-2xl',
  };

  const ls = logoSizes[size];
  const ts = textSizes[size];

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <svg
        width={ls}
        height={ls}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle cx="32" cy="32" r="30" fill="#1e1e1e" stroke="#ff6b35" strokeWidth="2"/>
        <path
          d="M20 44V20h8l8 12 8-12h8v24h-6V26l-8 12h-6l-8-12v18h-6z"
          fill="#ff6b35"
        />
        <path
          d="M14 28h4M14 32h6M14 36h4"
          stroke="#ff6b35"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.6"
        />
      </svg>
      <span className={`${ts} font-bold text-white tracking-wider`}>RUNNER</span>
    </div>
  );
};

export default Logo;