'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';
import { useClaim } from '@/hooks/useClaim';

export function ClaimButton() {
  const { connected, publicKey, signMessage } = useWallet();
  const { claimTokens, isLoading } = useClaim();
  const [isClaiming, setIsClaiming] = useState(false);

  const handleClaim = async () => {
    if (!connected || !publicKey || !signMessage) {
      toast.error('Please connect your wallet first');
      return;
    }

    setIsClaiming(true);

    try {
      await claimTokens();
      toast.success('Claim submitted successfully! Check status page for updates.');
    } catch (error: any) {
      toast.error(error.message || 'Failed to claim tokens');
    } finally {
      setIsClaiming(false);
    }
  };

  if (!connected) {
    return (
      <div className="text-center">
        <p className="text-white mb-4">Connect your wallet to claim tokens</p>
      </div>
    );
  }

  return (
    <button
      onClick={handleClaim}
      disabled={isClaiming || isLoading}
      className="w-full bg-gradient-to-r from-solana-purple to-solana-green text-white font-bold py-4 px-8 rounded-xl hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isClaiming || isLoading ? 'Processing...' : 'Claim Tokens'}
    </button>
  );
}
