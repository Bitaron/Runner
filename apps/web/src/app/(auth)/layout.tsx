'use client';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#1e1e1e] flex items-center justify-center">
      <div className="w-full max-w-md p-8">
        {children}
      </div>
    </div>
  );
}
