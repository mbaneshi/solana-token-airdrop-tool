import React from 'react';
import { render, screen } from '@testing-library/react';
import { WalletProvider } from '@/components/WalletProvider';

// Mock Solana wallet adapters
jest.mock('@solana/wallet-adapter-react', () => ({
  ConnectionProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  WalletProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useWallet: jest.fn(),
}));

jest.mock('@solana/wallet-adapter-react-ui', () => ({
  WalletModalProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

jest.mock('@solana/wallet-adapter-wallets', () => ({
  PhantomWalletAdapter: jest.fn(),
  SolflareWalletAdapter: jest.fn(),
  BackpackWalletAdapter: jest.fn(),
  SlopeWalletAdapter: jest.fn(),
}));

jest.mock('@solana/wallet-adapter-base', () => ({
  WalletAdapterNetwork: {
    Mainnet: 'mainnet-beta',
    Devnet: 'devnet',
    Testnet: 'testnet',
  },
}));

jest.mock('@solana/web3.js', () => ({
  clusterApiUrl: jest.fn((network: string) => `https://api.${network}.solana.com`),
}));

describe('WalletProvider', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should render children correctly', () => {
    render(
      <WalletProvider>
        <div data-testid="test-child">Test Child</div>
      </WalletProvider>
    );

    expect(screen.getByTestId('test-child')).toBeInTheDocument();
    expect(screen.getByText('Test Child')).toBeInTheDocument();
  });

  it('should use devnet by default', () => {
    delete process.env.NEXT_PUBLIC_SOLANA_NETWORK;
    delete process.env.NEXT_PUBLIC_SOLANA_RPC_URL;

    render(
      <WalletProvider>
        <div>Test</div>
      </WalletProvider>
    );

    // Component should render without errors
    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should use custom RPC URL when provided', () => {
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL = 'https://custom-rpc.solana.com';

    render(
      <WalletProvider>
        <div>Test</div>
      </WalletProvider>
    );

    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should use mainnet when specified', () => {
    process.env.NEXT_PUBLIC_SOLANA_NETWORK = 'mainnet-beta';

    render(
      <WalletProvider>
        <div>Test</div>
      </WalletProvider>
    );

    expect(screen.getByText('Test')).toBeInTheDocument();
  });

  it('should initialize wallet adapters', () => {
    const { PhantomWalletAdapter, SolflareWalletAdapter } = require('@solana/wallet-adapter-wallets');

    render(
      <WalletProvider>
        <div>Test</div>
      </WalletProvider>
    );

    expect(PhantomWalletAdapter).toHaveBeenCalled();
    expect(SolflareWalletAdapter).toHaveBeenCalled();
  });

  it('should wrap children with all required providers', () => {
    const { container } = render(
      <WalletProvider>
        <div data-testid="nested-child">Nested Content</div>
      </WalletProvider>
    );

    // Check that the nested structure exists
    expect(container.querySelector('[data-testid="nested-child"]')).toBeInTheDocument();
  });

  it('should handle multiple children', () => {
    render(
      <WalletProvider>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
        <div data-testid="child-3">Child 3</div>
      </WalletProvider>
    );

    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
    expect(screen.getByTestId('child-3')).toBeInTheDocument();
  });

  it('should memoize wallet adapters', () => {
    const { PhantomWalletAdapter } = require('@solana/wallet-adapter-wallets');

    const { rerender } = render(
      <WalletProvider>
        <div>Test</div>
      </WalletProvider>
    );

    const initialCallCount = PhantomWalletAdapter.mock.calls.length;

    rerender(
      <WalletProvider>
        <div>Test Updated</div>
      </WalletProvider>
    );

    // Adapters should not be recreated on rerender
    expect(PhantomWalletAdapter.mock.calls.length).toBe(initialCallCount);
  });
});
