import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { DashboardMetrics } from '@/components/DashboardMetrics';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { api } from '@/lib/api';

// Mock API
jest.mock('@/lib/api');

describe('DashboardMetrics', () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const mockMetrics = {
    totalSupply: '1000000',
    tokensDistributed: '500000',
    tokensRemaining: '500000',
    totalClaims: 250,
    successfulClaims: 245,
    failedClaims: 5,
    pendingClaims: 10,
    successRate: 98.0,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    queryClient.clear();
  });

  const renderWithQuery = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  it('should render loading state initially', () => {
    (api.getMetrics as jest.Mock).mockImplementation(() =>
      new Promise(() => {}) // Never resolves
    );

    renderWithQuery(<DashboardMetrics />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it('should render metrics data when loaded', async () => {
    (api.getMetrics as jest.Mock).mockResolvedValue(mockMetrics);

    renderWithQuery(<DashboardMetrics />);

    await waitFor(() => {
      expect(screen.getByText('1,000,000')).toBeInTheDocument();
      expect(screen.getByText('500,000')).toBeInTheDocument();
      expect(screen.getByText('250')).toBeInTheDocument();
      expect(screen.getByText('98.0%')).toBeInTheDocument();
    });
  });

  it('should display error message on API failure', async () => {
    (api.getMetrics as jest.Mock).mockRejectedValue(new Error('Failed to fetch metrics'));

    renderWithQuery(<DashboardMetrics />);

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  it('should format large numbers correctly', async () => {
    const largeMetrics = {
      ...mockMetrics,
      totalSupply: '1234567890',
      tokensDistributed: '987654321',
    };
    (api.getMetrics as jest.Mock).mockResolvedValue(largeMetrics);

    renderWithQuery(<DashboardMetrics />);

    await waitFor(() => {
      expect(screen.getByText(/1,234,567,890/)).toBeInTheDocument();
      expect(screen.getByText(/987,654,321/)).toBeInTheDocument();
    });
  });

  it('should calculate and display correct success rate', async () => {
    const metricsWithRate = {
      ...mockMetrics,
      successfulClaims: 190,
      totalClaims: 200,
      successRate: 95.0,
    };
    (api.getMetrics as jest.Mock).mockResolvedValue(metricsWithRate);

    renderWithQuery(<DashboardMetrics />);

    await waitFor(() => {
      expect(screen.getByText('95.0%')).toBeInTheDocument();
    });
  });

  it('should handle zero claims gracefully', async () => {
    const zeroMetrics = {
      ...mockMetrics,
      totalClaims: 0,
      successfulClaims: 0,
      failedClaims: 0,
      successRate: 0,
    };
    (api.getMetrics as jest.Mock).mockResolvedValue(zeroMetrics);

    renderWithQuery(<DashboardMetrics />);

    await waitFor(() => {
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  it('should refetch data on interval', async () => {
    jest.useFakeTimers();
    (api.getMetrics as jest.Mock).mockResolvedValue(mockMetrics);

    renderWithQuery(<DashboardMetrics />);

    await waitFor(() => {
      expect(api.getMetrics).toHaveBeenCalledTimes(1);
    });

    // Fast-forward 30 seconds (typical refetch interval)
    jest.advanceTimersByTime(30000);

    await waitFor(() => {
      expect(api.getMetrics).toHaveBeenCalledTimes(2);
    });

    jest.useRealTimers();
  });

  it('should display pending claims count', async () => {
    (api.getMetrics as jest.Mock).mockResolvedValue(mockMetrics);

    renderWithQuery(<DashboardMetrics />);

    await waitFor(() => {
      expect(screen.getByText('10')).toBeInTheDocument();
    });
  });
});
