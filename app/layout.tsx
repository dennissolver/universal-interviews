// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { clientConfig } from '@/config/client';
import { CorporateHeader } from '@/app/components/corporate/CorporateHeader';
import { CorporateFooter } from '@/app/components/corporate/CorporateFooter';

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
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          <CorporateHeader productName="CX-3500 Survey" productAcronym="CX" theme="dark" />
          <main className="flex-1">{children}</main>
          <CorporateFooter productName="CX-3500 Survey" theme="dark" />
        </div>
      </body>
    </html>
  );
}
