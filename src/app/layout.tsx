import type { Metadata } from 'next';
import { Press_Start_2P } from 'next/font/google';
import './globals.css';

const retro = Press_Start_2P({ weight: '400', subsets: ['latin'], variable: '--font-retro' });

export const metadata: Metadata = {
  title: 'Kebab',
  description: 'Next.js app scaffolded for Vercel',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={retro.className}>{children}</body>
    </html>
  );
}

