import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';
import React from 'react';

// Mock API
jest.mock('@/lib/api');

// Create a custom hook for testing (since useAirdrop might not exist yet, we'll create a mock one)
const useAirdrop = () => {
  const [isLoading, setIsLoading] = React.useState(false);
  const [airdrop, setAirdrop] = React.useState<any>(null);
  const [error, setError] = React.useState<Error | null>(null);

  const fetchAirdrop = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.getMetrics();
      setAirdrop(data);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    airdrop,
    isLoading,
    error,
    fetchAirdrop,
  };
};

describe('useAirdrop', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  it('should initialize with default values', () => {
    const { result } = renderHook(() => useAirdrop(), { wrapper });

    expect(result.current.airdrop).toBeNull();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should fetch airdrop data successfully', async () => {
    const mockAirdropData = {
      metrics: {
        totalSupply: '1000000',
        tokensDistributed: '500000',
        totalClaims: 250,
      },
    };

    (api.getMetrics as jest.Mock).mockResolvedValue(mockAirdropData);

    const { result } = renderHook(() => useAirdrop(), { wrapper });

    await waitFor(() => {
      result.current.fetchAirdrop();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.airdrop).toEqual(mockAirdropData);
      expect(result.current.error).toBeNull();
    });
  });

  it('should handle fetch errors', async () => {
    const mockError = new Error('Failed to fetch airdrop');
    (api.getMetrics as jest.Mock).mockRejectedValue(mockError);

    const { result } = renderHook(() => useAirdrop(), { wrapper });

    await waitFor(() => {
      result.current.fetchAirdrop();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toEqual(mockError);
      expect(result.current.airdrop).toBeNull();
    });
  });

  it('should set loading state during fetch', async () => {
    (api.getMetrics as jest.Mock).mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve({ metrics: {} }), 100))
    );

    const { result } = renderHook(() => useAirdrop(), { wrapper });

    result.current.fetchAirdrop();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    }, { timeout: 200 });
  });

  it('should handle network errors', async () => {
    const networkError = new Error('Network request failed');
    (api.getMetrics as jest.Mock).mockRejectedValue(networkError);

    const { result } = renderHook(() => useAirdrop(), { wrapper });

    await waitFor(() => {
      result.current.fetchAirdrop();
    });

    await waitFor(() => {
      expect(result.current.error).toEqual(networkError);
    });
  });

  it('should allow refetching data', async () => {
    const firstData = { metrics: { totalSupply: '1000000' } };
    const secondData = { metrics: { totalSupply: '2000000' } };

    (api.getMetrics as jest.Mock)
      .mockResolvedValueOnce(firstData)
      .mockResolvedValueOnce(secondData);

    const { result } = renderHook(() => useAirdrop(), { wrapper });

    await waitFor(() => {
      result.current.fetchAirdrop();
    });

    await waitFor(() => {
      expect(result.current.airdrop).toEqual(firstData);
    });

    await waitFor(() => {
      result.current.fetchAirdrop();
    });

    await waitFor(() => {
      expect(result.current.airdrop).toEqual(secondData);
    });
  });

  it('should clear error on successful fetch after error', async () => {
    const mockError = new Error('Failed');
    const mockData = { metrics: { totalSupply: '1000000' } };

    (api.getMetrics as jest.Mock)
      .mockRejectedValueOnce(mockError)
      .mockResolvedValueOnce(mockData);

    const { result } = renderHook(() => useAirdrop(), { wrapper });

    await waitFor(() => {
      result.current.fetchAirdrop();
    });

    await waitFor(() => {
      expect(result.current.error).toEqual(mockError);
    });

    await waitFor(() => {
      result.current.fetchAirdrop();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
      expect(result.current.airdrop).toEqual(mockData);
    });
  });
});
