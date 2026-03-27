'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogoWithText } from '@/components/ui/Logo';

function LoadingSpinner() {
  return (
    <div className="min-h-screen bg-[#1e1e1e] flex flex-col items-center justify-center">
      <LogoWithText size="lg" className="mb-8" />
      <div className="relative">
        <div className="w-12 h-12 border-4 border-[#3d3d3d] rounded-full"></div>
        <div className="absolute top-0 left-0 w-12 h-12 border-4 border-transparent border-t-[#ff6b35] rounded-full animate-spin"></div>
      </div>
      <p className="text-gray-500 mt-4 text-sm">Redirecting...</p>
    </div>
  );
}

export default function Home() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    const authData = localStorage.getItem('apiforge-auth');
    const isAuth = authData ? JSON.parse(authData)?.state?.isAuthenticated : false;
    
    router.push(isAuth ? '/workspace' : '/login');
  }, [mounted, router]);

  return <LoadingSpinner />;
}