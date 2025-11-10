'use client';

import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export function DashboardMetrics() {
  const { data, isLoading } = useQuery({
    queryKey: ['metrics'],
    queryFn: () => api.getMetrics(),
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="bg-white/10 backdrop-blur-lg rounded-xl p-6 animate-pulse"
          >
            <div className="h-4 bg-white/20 rounded w-3/4 mb-4"></div>
            <div className="h-8 bg-white/20 rounded w-1/2"></div>
          </div>
        ))}
      </div>
    );
  }

  const metrics = data?.metrics;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
      <MetricCard
        title="Total Supply"
        value={metrics?.totalSupply || '0'}
        suffix="Tokens"
      />
      <MetricCard
        title="Tokens Distributed"
        value={metrics?.tokensDistributed || '0'}
        suffix="Tokens"
        color="green"
      />
      <MetricCard
        title="Success Rate"
        value={metrics?.successRate || '0'}
        suffix="%"
        color="blue"
      />
      <MetricCard
        title="Total Claims"
        value={metrics?.totalClaims || '0'}
        suffix="Claims"
      />
    </div>
  );
}

function MetricCard({
  title,
  value,
  suffix,
  color = 'white',
}: {
  title: string;
  value: string;
  suffix?: string;
  color?: string;
}) {
  const colorClass =
    color === 'green'
      ? 'text-solana-green'
      : color === 'blue'
      ? 'text-blue-400'
      : 'text-white';

  return (
    <div className="bg-white/10 backdrop-blur-lg rounded-xl p-6">
      <h3 className="text-sm text-gray-300 mb-2">{title}</h3>
      <p className={`text-3xl font-bold ${colorClass}`}>
        {value}
        {suffix && <span className="text-lg ml-2">{suffix}</span>}
      </p>
    </div>
  );
}
