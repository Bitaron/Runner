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
      {/* Background gradient */}
      <defs>
        <linearGradient id="runnerGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ff6b35" />
          <stop offset="100%" stopColor="#ff8c5a" />
        </linearGradient>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2d2d2d" />
          <stop offset="100%" stopColor="#1e1e1e" />
        </linearGradient>
      </defs>
      
      {/* Rounded square background */}
      <rect x="4" y="4" width="56" height="56" rx="12" fill="url(#bgGradient)" />
      
      {/* Runner arrow / fast motion R */}
      <path
        d="M18 42L18 22L30 22L30 26L22 26L22 30L28 30L28 34L22 34L22 42L18 42Z"
        fill="url(#runnerGradient)"
      />
      
      {/* Speed lines */}
      <path d="M36 24L44 24" stroke="#ff6b35" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M36 30L48 30" stroke="#ff6b35" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M36 36L44 36" stroke="#ff6b35" strokeWidth="2.5" strokeLinecap="round" />
      
      {/* Arrow indicator */}
      <path d="M44 42L50 48L44 48L44 42Z" fill="url(#runnerGradient)" />
      <path d="M48 42L50 44L48 46" stroke="url(#runnerGradient)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
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
        <defs>
          <linearGradient id="runnerGradientSm" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff6b35" />
            <stop offset="100%" stopColor="#ff8c5a" />
          </linearGradient>
          <linearGradient id="bgGradientSm" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2d2d2d" />
            <stop offset="100%" stopColor="#1e1e1e" />
          </linearGradient>
        </defs>
        <rect x="4" y="4" width="56" height="56" rx="12" fill="url(#bgGradientSm)" />
        <path d="M18 42L18 22L30 22L30 26L22 26L22 30L28 30L28 34L22 34L22 42L18 42Z" fill="url(#runnerGradientSm)" />
        <path d="M36 24L44 24" stroke="#ff6b35" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M36 30L48 30" stroke="#ff6b35" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M36 36L44 36" stroke="#ff6b35" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M44 42L50 48L44 48L44 42Z" fill="url(#runnerGradientSm)" />
      </svg>
      <span className={`${ts} font-bold text-white tracking-wider`}>RUNNER</span>
    </div>
  );
};

export default Logo;