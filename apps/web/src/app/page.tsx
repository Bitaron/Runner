'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-[#1e1e1e] flex flex-col items-center justify-center">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-[#3d3d3d] rounded-full"></div>
        <div className="absolute top-0 left-0 w-16 h-16 border-4 border-transparent border-t-[#ff6b35] rounded-full animate-spin"></div>
      </div>
      <div className="mt-8 flex flex-col items-center">
        <h1 className="text-2xl font-bold text-white tracking-wider">RUNNER</h1>
        <p className="text-gray-500 mt-2 text-sm">Loading your workspace...</p>
      </div>
      <div className="mt-8 flex gap-1">
        <div className="w-2 h-2 bg-[#ff6b35] rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-[#ff6b35] rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-[#ff6b35] rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .animate-spin {
          animation: spin 1s linear infinite;
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        .animate-bounce {
          animation: bounce 0.6s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s.hasHydrated);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && hasHydrated) {
      if (isAuthenticated) {
        router.push('/workspace');
      } else {
        router.push('/login');
      }
    }
  }, [mounted, hasHydrated, isAuthenticated, router]);

  return <LoadingSpinner />;
}