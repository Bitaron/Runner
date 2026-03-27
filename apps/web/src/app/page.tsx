'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export default function Home() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      if (isAuthenticated) {
        router.push('/workspace');
      } else {
        router.push('/login');
      }
    }
  }, [mounted, isAuthenticated, router]);

  return (
    <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center">
      <div className="text-gray-400">Loading...</div>
    </div>
  );
}