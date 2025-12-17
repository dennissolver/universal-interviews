// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { clientConfig } from '@/config/client';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: clientConfig.platform.name,
  description: clientConfig.platform.description,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}