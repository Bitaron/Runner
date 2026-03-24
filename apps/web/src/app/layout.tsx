import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'APIForge - API Development Platform',
  description: 'A powerful API testing tool similar to Postman',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#1e1e1e]">{children}</body>
    </html>
  );
}
