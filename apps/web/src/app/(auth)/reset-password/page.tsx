'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LogoWithText } from '@/components/ui/Logo';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFieldErrors({});

    if (password !== confirmPassword) {
      setFieldErrors((prev) => ({ ...prev, confirmPassword: 'Passwords do not match' }));
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.post('/api/auth/reset-password', { token, password });

      if (response.success) {
        router.push('/login');
      } else {
        setError(response.error || 'Password reset failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="space-y-6 text-center">
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-500 text-sm">
          This reset link is invalid or incomplete. Please request a new one.
        </div>
        <Link href="/forgot-password" className="block text-sm text-[#ff6b35] hover:underline">
          Request new link
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-md text-red-500 text-sm">
          {error}
        </div>
      )}

      <Input
        label="New Password"
        type="password"
        autoComplete="new-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="At least 8 characters with a letter and number"
        error={fieldErrors.password}
        required
      />

      <Input
        label="Confirm New Password"
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        placeholder="Re-enter your new password"
        error={fieldErrors.confirmPassword}
        required
      />

      <Button type="submit" className="w-full" loading={isLoading}>
        Reset Password
      </Button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="space-y-8">
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <LogoWithText size="lg" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Reset Password</h1>
        <p className="text-gray-400">Choose a new password for your account</p>
      </div>

      <Suspense fallback={<div className="text-center text-gray-500 text-sm">Loading…</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
