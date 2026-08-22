'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LogoWithText } from '@/components/ui/Logo';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});
    setIsLoading(true);

    try {
      const response = await apiClient.post('/api/auth/forgot-password', { email });

      if (response.success) {
        setSubmitted(true);
      } else {
        setError(response.error || 'Request failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <LogoWithText size="lg" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Forgot Password</h1>
        <p className="text-gray-400">We&apos;ll send you a reset link</p>
      </div>

      {submitted ? (
        <div className="space-y-6 text-center">
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-md text-green-400 text-sm">
            If an account exists for that email, a password reset link has been sent.
          </div>
          <Link href="/login" className="block text-sm text-[#ff6b35] hover:underline">
            Back to sign in
          </Link>
        </div>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-500 text-sm">
                {error}
              </div>
            )}

            <Input
              label="Email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              error={fieldErrors.email}
              required
            />

            <Button type="submit" className="w-full" loading={isLoading}>
              Send Reset Link
            </Button>
          </form>

          <p className="text-center text-gray-400 text-sm">
            Remembered it?{' '}
            <Link href="/login" className="text-[#ff6b35] hover:underline">
              Sign in
            </Link>
          </p>
        </>
      )}
    </div>
  );
}
