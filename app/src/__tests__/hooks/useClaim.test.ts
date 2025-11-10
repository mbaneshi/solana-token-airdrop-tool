import { renderHook, act, waitFor } from '@testing-library/react';
import { useClaim } from '@/hooks/useClaim';
import { useWallet } from '@solana/wallet-adapter-react';
import { api } from '@/lib/api';

// Mock dependencies
jest.mock('@solana/wallet-adapter-react');
jest.mock('@/lib/api');
jest.mock('bs58', () => ({
  encode: jest.fn((data: Uint8Array) => 'mockedBase58Signature'),
}));

describe('useClaim', () => {
  const mockPublicKey = {
    toBase58: jest.fn(() => 'mockPublicKey123'),
  };
  const mockSignMessage = jest.fn();
  const mockGetNonce = jest.fn();
  const mockVerifySignature = jest.fn();
  const mockSubmitClaim = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();

    (useWallet as jest.Mock).mockReturnValue({
      publicKey: mockPublicKey,
      signMessage: mockSignMessage,
    });

    (api.getNonce as jest.Mock) = mockGetNonce;
    (api.verifySignature as jest.Mock) = mockVerifySignature;
    (api.submitClaim as jest.Mock) = mockSubmitClaim;
  });

  it('should initialize with isLoading false', () => {
    const { result } = renderHook(() => useClaim());
    expect(result.current.isLoading).toBe(false);
  });

  it('should throw error if wallet not connected', async () => {
    (useWallet as jest.Mock).mockReturnValue({
      publicKey: null,
      signMessage: null,
    });

    const { result } = renderHook(() => useClaim());

    await expect(result.current.claimTokens()).rejects.toThrow('Wallet not connected');
  });

  it('should successfully complete claim flow', async () => {
    const mockNonce = 'mock-nonce-123';
    const mockMessage = `Sign this message to claim tokens. Nonce: ${mockNonce}`;
    const mockToken = 'mock-jwt-token';
    const mockSignature = new Uint8Array([1, 2, 3, 4]);
    const mockClaimResponse = {
      success: true,
      claimId: 'claim-123',
      status: 'pending',
    };

    mockGetNonce.mockResolvedValue({
      nonce: mockNonce,
      message: mockMessage,
    });
    mockSignMessage.mockResolvedValue(mockSignature);
    mockVerifySignature.mockResolvedValue({
      token: mockToken,
    });
    mockSubmitClaim.mockResolvedValue(mockClaimResponse);

    const { result } = renderHook(() => useClaim());

    let claimResult;
    await act(async () => {
      claimResult = await result.current.claimTokens();
    });

    expect(mockGetNonce).toHaveBeenCalledWith('mockPublicKey123');
    expect(mockSignMessage).toHaveBeenCalled();
    expect(mockVerifySignature).toHaveBeenCalledWith(
      'mockPublicKey123',
      'mockedBase58Signature',
      mockMessage
    );
    expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', mockToken);
    expect(mockSubmitClaim).toHaveBeenCalled();
    expect(claimResult).toEqual(mockClaimResponse);
  });

  it('should set isLoading to true during claim process', async () => {
    mockGetNonce.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
    mockSignMessage.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockVerifySignature.mockResolvedValue({ token: 'token' });
    mockSubmitClaim.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useClaim());

    act(() => {
      result.current.claimTokens();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
  });

  it('should handle getNonce failure', async () => {
    const errorMessage = 'Failed to get nonce';
    mockGetNonce.mockRejectedValue(new Error(errorMessage));

    const { result } = renderHook(() => useClaim());

    await expect(result.current.claimTokens()).rejects.toThrow(errorMessage);
    expect(result.current.isLoading).toBe(false);
  });

  it('should handle signature verification failure', async () => {
    mockGetNonce.mockResolvedValue({
      nonce: 'nonce',
      message: 'message',
    });
    mockSignMessage.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockVerifySignature.mockRejectedValue({
      response: { data: { message: 'Invalid signature' } },
    });

    const { result } = renderHook(() => useClaim());

    await expect(result.current.claimTokens()).rejects.toThrow('Invalid signature');
  });

  it('should handle claim submission failure', async () => {
    mockGetNonce.mockResolvedValue({
      nonce: 'nonce',
      message: 'message',
    });
    mockSignMessage.mockResolvedValue(new Uint8Array([1, 2, 3]));
    mockVerifySignature.mockResolvedValue({ token: 'token' });
    mockSubmitClaim.mockRejectedValue(new Error('Claim already exists'));

    const { result } = renderHook(() => useClaim());

    await expect(result.current.claimTokens()).rejects.toThrow('Claim already exists');
  });

  it('should encode signature as base58', async () => {
    const mockSignature = new Uint8Array([1, 2, 3, 4, 5]);
    mockGetNonce.mockResolvedValue({
      nonce: 'nonce',
      message: 'message',
    });
    mockSignMessage.mockResolvedValue(mockSignature);
    mockVerifySignature.mockResolvedValue({ token: 'token' });
    mockSubmitClaim.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useClaim());

    await act(async () => {
      await result.current.claimTokens();
    });

    expect(mockVerifySignature).toHaveBeenCalledWith(
      'mockPublicKey123',
      'mockedBase58Signature',
      'message'
    );
  });

  it('should store JWT token in localStorage', async () => {
    const mockToken = 'jwt-token-12345';
    mockGetNonce.mockResolvedValue({ nonce: 'n', message: 'm' });
    mockSignMessage.mockResolvedValue(new Uint8Array([1]));
    mockVerifySignature.mockResolvedValue({ token: mockToken });
    mockSubmitClaim.mockResolvedValue({ success: true });

    const { result } = renderHook(() => useClaim());

    await act(async () => {
      await result.current.claimTokens();
    });

    expect(localStorage.setItem).toHaveBeenCalledWith('auth_token', mockToken);
  });
});
