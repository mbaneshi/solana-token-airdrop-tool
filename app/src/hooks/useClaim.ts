import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { api } from '@/lib/api';
import bs58 from 'bs58';

export function useClaim() {
  const { publicKey, signMessage } = useWallet();
  const [isLoading, setIsLoading] = useState(false);

  const claimTokens = async () => {
    if (!publicKey || !signMessage) {
      throw new Error('Wallet not connected');
    }

    setIsLoading(true);

    try {
      // Step 1: Get nonce
      const nonceResponse = await api.getNonce(publicKey.toBase58());
      const { nonce, message } = nonceResponse;

      // Step 2: Sign message
      const messageBytes = new TextEncoder().encode(message);
      const signature = await signMessage(messageBytes);
      const signatureBase58 = bs58.encode(signature);

      // Step 3: Verify signature and get JWT
      const authResponse = await api.verifySignature(
        publicKey.toBase58(),
        signatureBase58,
        message
      );

      // Store JWT token
      localStorage.setItem('auth_token', authResponse.token);

      // Step 4: Submit claim
      const claimResponse = await api.submitClaim();

      return claimResponse;
    } catch (error: any) {
      throw new Error(error.response?.data?.message || error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return { claimTokens, isLoading };
}
