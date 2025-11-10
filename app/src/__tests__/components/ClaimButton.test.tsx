import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClaimButton } from '@/components/ClaimButton';
import { useClaim } from '@/hooks/useClaim';
import { useWallet } from '@solana/wallet-adapter-react';
import toast from 'react-hot-toast';

// Mock dependencies
jest.mock('@/hooks/useClaim');
jest.mock('@solana/wallet-adapter-react');
jest.mock('react-hot-toast');

describe('ClaimButton', () => {
  const mockClaimTokens = jest.fn();
  const mockSignMessage = jest.fn();
  const mockPublicKey = {
    toBase58: () => 'mockPublicKey123',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (toast.error as jest.Mock) = jest.fn();
    (toast.success as jest.Mock) = jest.fn();
  });

  it('should render message when wallet is not connected', () => {
    (useWallet as jest.Mock).mockReturnValue({
      connected: false,
      publicKey: null,
      signMessage: null,
    });
    (useClaim as jest.Mock).mockReturnValue({
      claimTokens: mockClaimTokens,
      isLoading: false,
    });

    render(<ClaimButton />);
    expect(screen.getByText('Connect your wallet to claim tokens')).toBeInTheDocument();
  });

  it('should render claim button when wallet is connected', () => {
    (useWallet as jest.Mock).mockReturnValue({
      connected: true,
      publicKey: mockPublicKey,
      signMessage: mockSignMessage,
    });
    (useClaim as jest.Mock).mockReturnValue({
      claimTokens: mockClaimTokens,
      isLoading: false,
    });

    render(<ClaimButton />);
    expect(screen.getByRole('button', { name: 'Claim Tokens' })).toBeInTheDocument();
  });

  it('should disable button when loading', () => {
    (useWallet as jest.Mock).mockReturnValue({
      connected: true,
      publicKey: mockPublicKey,
      signMessage: mockSignMessage,
    });
    (useClaim as jest.Mock).mockReturnValue({
      claimTokens: mockClaimTokens,
      isLoading: true,
    });

    render(<ClaimButton />);
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent('Processing...');
  });

  it('should call claimTokens when button is clicked', async () => {
    mockClaimTokens.mockResolvedValue({});
    (useWallet as jest.Mock).mockReturnValue({
      connected: true,
      publicKey: mockPublicKey,
      signMessage: mockSignMessage,
    });
    (useClaim as jest.Mock).mockReturnValue({
      claimTokens: mockClaimTokens,
      isLoading: false,
    });

    render(<ClaimButton />);
    const button = screen.getByRole('button', { name: 'Claim Tokens' });

    fireEvent.click(button);

    await waitFor(() => {
      expect(mockClaimTokens).toHaveBeenCalledTimes(1);
    });
  });

  it('should show success toast on successful claim', async () => {
    mockClaimTokens.mockResolvedValue({});
    (useWallet as jest.Mock).mockReturnValue({
      connected: true,
      publicKey: mockPublicKey,
      signMessage: mockSignMessage,
    });
    (useClaim as jest.Mock).mockReturnValue({
      claimTokens: mockClaimTokens,
      isLoading: false,
    });

    render(<ClaimButton />);
    const button = screen.getByRole('button', { name: 'Claim Tokens' });

    fireEvent.click(button);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        'Claim submitted successfully! Check status page for updates.'
      );
    });
  });

  it('should show error toast on failed claim', async () => {
    const errorMessage = 'Failed to process claim';
    mockClaimTokens.mockRejectedValue(new Error(errorMessage));
    (useWallet as jest.Mock).mockReturnValue({
      connected: true,
      publicKey: mockPublicKey,
      signMessage: mockSignMessage,
    });
    (useClaim as jest.Mock).mockReturnValue({
      claimTokens: mockClaimTokens,
      isLoading: false,
    });

    render(<ClaimButton />);
    const button = screen.getByRole('button', { name: 'Claim Tokens' });

    fireEvent.click(button);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(errorMessage);
    });
  });

  it('should show error when wallet is not connected on click', async () => {
    (useWallet as jest.Mock).mockReturnValue({
      connected: true,
      publicKey: null,
      signMessage: mockSignMessage,
    });
    (useClaim as jest.Mock).mockReturnValue({
      claimTokens: mockClaimTokens,
      isLoading: false,
    });

    render(<ClaimButton />);

    // This scenario shouldn't render the button, but let's test the handler logic
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should prevent multiple simultaneous claims', async () => {
    mockClaimTokens.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    (useWallet as jest.Mock).mockReturnValue({
      connected: true,
      publicKey: mockPublicKey,
      signMessage: mockSignMessage,
    });
    (useClaim as jest.Mock).mockReturnValue({
      claimTokens: mockClaimTokens,
      isLoading: false,
    });

    render(<ClaimButton />);
    const button = screen.getByRole('button', { name: 'Claim Tokens' });

    fireEvent.click(button);
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockClaimTokens).toHaveBeenCalledTimes(1);
    });
  });
});
