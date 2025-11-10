import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../styles/globals.css';
import { WalletProvider } from '@/components/WalletProvider';
import { QueryProvider } from '@/components/QueryProvider';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Solana Token Airdrop Platform',
  description: 'Claim your tokens on the Solana blockchain',
  openGraph: {
    title: 'Solana Token Airdrop Platform',
    description: 'Claim your tokens on the Solana blockchain',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <QueryProvider>
          <WalletProvider>
            {children}
            <Toaster position="bottom-right" />
          </WalletProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
