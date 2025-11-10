import { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { api } from '@/lib/api';

export interface ClaimStatus {
  status: 'pending' | 'processing' | 'completed' | 'failed';
  amount?: string;
  claimedAt?: string;
  transactionSignature?: string;
  retryCount?: number;
}

interface UseClaimStatusOptions {
  enabled?: boolean;
  pollingInterval?: number; // milliseconds
  maxRetries?: number;
}

export function useClaimStatus(options: UseClaimStatusOptions = {}) {
  const {
    enabled = true,
    pollingInterval = 3000, // 3 seconds
    maxRetries = 3,
  } = options;

  const { publicKey } = useWallet();
  const [claimStatus, setClaimStatus] = useState<ClaimStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingRef = useRef(false);

  const fetchClaimStatus = useCallback(async () => {
    if (!publicKey || !enabled) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await api.getClaimStatus(publicKey.toBase58());

      if (response.hasClaimed && response.claim) {
        setClaimStatus(response.claim);

        // Stop polling if claim is completed or failed
        if (response.claim.status === 'completed' || response.claim.status === 'failed') {
          stopPolling();
        }
      } else {
        setClaimStatus(null);
      }

      // Reset retry count on success
      setRetryCount(0);
    } catch (err) {
      const error = err as Error;
      setError(error);

      // Increment retry count
      if (retryCount < maxRetries) {
        setRetryCount(prev => prev + 1);
      } else {
        // Stop polling after max retries
        stopPolling();
      }
    } finally {
      setIsLoading(false);
    }
  }, [publicKey, enabled, retryCount, maxRetries]);

  const startPolling = useCallback(() => {
    if (isPollingRef.current) return;

    isPollingRef.current = true;

    // Fetch immediately
    fetchClaimStatus();

    // Then poll at interval
    intervalRef.current = setInterval(() => {
      fetchClaimStatus();
    }, pollingInterval);
  }, [fetchClaimStatus, pollingInterval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    isPollingRef.current = false;
  }, []);

  const resetAndPoll = useCallback(() => {
    setClaimStatus(null);
    setError(null);
    setRetryCount(0);
    stopPolling();
    startPolling();
  }, [startPolling, stopPolling]);

  // Auto-start polling when component mounts and wallet is connected
  useEffect(() => {
    if (publicKey && enabled) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [publicKey, enabled, startPolling, stopPolling]);

  // Manual retry for failed claims
  const retry = useCallback(async () => {
    if (!claimStatus || claimStatus.status !== 'failed') return;

    setRetryCount(0);
    setError(null);
    await fetchClaimStatus();
  }, [claimStatus, fetchClaimStatus]);

  return {
    claimStatus,
    isLoading,
    error,
    retryCount,
    isPolling: isPollingRef.current,
    startPolling,
    stopPolling,
    retry,
    refetch: fetchClaimStatus,
    resetAndPoll,
  };
}
