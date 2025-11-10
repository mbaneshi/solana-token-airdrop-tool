'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import Link from 'next/link';
import { DashboardMetrics } from '@/components/DashboardMetrics';
import { ClaimButton } from '@/components/ClaimButton';

export default function Home() {
  const { connected, publicKey } = useWallet();

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-black">
      <nav className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-white">Token Airdrop</h1>
          <div className="flex gap-4">
            <Link
              href="/status"
              className="px-4 py-2 text-white hover:text-solana-green transition"
            >
              Check Status
            </Link>
            <Link
              href="/faq"
              className="px-4 py-2 text-white hover:text-solana-green transition"
            >
              FAQ
            </Link>
            <WalletMultiButton />
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-5xl font-bold text-white mb-4">
            Claim Your Tokens
          </h2>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Connect your Solana wallet to claim your share of the airdrop.
            First come, first served until supply runs out.
          </p>
        </div>

        <DashboardMetrics />

        <div className="max-w-2xl mx-auto mt-12 bg-white/10 backdrop-blur-lg rounded-2xl p-8">
          <h3 className="text-2xl font-bold text-white mb-6">How to Claim</h3>
          <ol className="space-y-4 text-gray-300">
            <li className="flex items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-solana-purple rounded-full flex items-center justify-center text-white font-bold mr-4">
                1
              </span>
              <div>
                <strong className="text-white">Connect Your Wallet</strong>
                <p className="text-sm">
                  Click the button above to connect your Solana wallet
                  (Phantom, Solflare, etc.)
                </p>
              </div>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-solana-purple rounded-full flex items-center justify-center text-white font-bold mr-4">
                2
              </span>
              <div>
                <strong className="text-white">Sign Authentication Message</strong>
                <p className="text-sm">
                  Sign a message to prove wallet ownership (no gas fees)
                </p>
              </div>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-solana-purple rounded-full flex items-center justify-center text-white font-bold mr-4">
                3
              </span>
              <div>
                <strong className="text-white">Claim Your Tokens</strong>
                <p className="text-sm">
                  Click the claim button and wait for transaction confirmation
                </p>
              </div>
            </li>
            <li className="flex items-start">
              <span className="flex-shrink-0 w-8 h-8 bg-solana-purple rounded-full flex items-center justify-center text-white font-bold mr-4">
                4
              </span>
              <div>
                <strong className="text-white">Receive Tokens</strong>
                <p className="text-sm">
                  Tokens will appear in your wallet within 30-60 seconds
                </p>
              </div>
            </li>
          </ol>

          <div className="mt-8 pt-8 border-t border-white/20">
            <ClaimButton />
          </div>
        </div>

        <div className="max-w-4xl mx-auto mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
            <div className="text-3xl mb-2">⚡</div>
            <h4 className="text-lg font-bold text-white mb-2">Fast</h4>
            <p className="text-sm text-gray-300">
              Claims processed in under 30 seconds on Solana
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
            <div className="text-3xl mb-2">🔒</div>
            <h4 className="text-lg font-bold text-white mb-2">Secure</h4>
            <p className="text-sm text-gray-300">
              Wallet signature verification and anti-sybil protection
            </p>
          </div>
          <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
            <div className="text-3xl mb-2">🎯</div>
            <h4 className="text-lg font-bold text-white mb-2">Fair</h4>
            <p className="text-sm text-gray-300">
              One claim per wallet, first come first served
            </p>
          </div>
        </div>
      </main>

      <footer className="container mx-auto px-4 py-8 mt-20 text-center text-gray-400">
        <p>Built on Solana • Powered by Anchor Framework</p>
      </footer>
    </div>
  );
}
