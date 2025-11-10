import { processClaimBatch, confirmTransaction } from '../../services/distribution.service';
import prisma from '../../config/database';
import { connection } from '../../config/solana';
import { ClaimJob } from '../../queue/claimQueue';

// Mock Solana connection
jest.mock('../../config/solana', () => ({
  connection: {
    getAccountInfo: jest.fn(),
    confirmTransaction: jest.fn(),
    getTransaction: jest.fn(),
  },
  getAuthorityWallet: jest.fn(() => ({
    publicKey: {
      toBase58: () => 'authorityWallet',
    },
  })),
  PROGRAM_ID: '11111111111111111111111111111111',
}));

jest.mock('@solana/web3.js', () => ({
  ...jest.requireActual('@solana/web3.js'),
  Transaction: jest.fn(() => ({
    add: jest.fn(),
  })),
  sendAndConfirmTransaction: jest.fn().mockResolvedValue('mockSignature123'),
  PublicKey: jest.fn((key: string) => ({
    toBase58: () => key,
    toBytes: () => new Uint8Array(32),
  })),
  SystemProgram: {},
}));

jest.mock('@solana/spl-token', () => ({
  createTransferInstruction: jest.fn(),
  getAssociatedTokenAddress: jest.fn().mockResolvedValue('mockTokenAddress'),
  createAssociatedTokenAccountInstruction: jest.fn(),
  TOKEN_PROGRAM_ID: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  ASSOCIATED_TOKEN_PROGRAM_ID: 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL',
}));

describe('Claim Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processClaimBatch', () => {
    const mockClaimJob: ClaimJob = {
      claimId: 'claim-1',
      walletAddress: 'userWallet123',
      amount: 100000000000, // 100 tokens in lamports
    };

    it('should process a claim successfully', async () => {
      const mockClaim = {
        id: 'claim-1',
        walletAddress: 'userWallet123',
        claimStatus: 'pending',
      };

      (prisma.usersClaim.update as jest.Mock).mockResolvedValue(mockClaim);
      (prisma.usersClaim.findUnique as jest.Mock).mockResolvedValue(mockClaim);
      (connection.getAccountInfo as jest.Mock).mockResolvedValue({});
      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);

      const result = await processClaimBatch([mockClaimJob]);

      expect(result.success).toBe(true);
      expect(result.signature).toBe('mockSignature123');
      expect(prisma.usersClaim.update).toHaveBeenCalledWith({
        where: { id: 'claim-1' },
        data: { claimStatus: 'processing' },
      });
    });

    it('should handle empty batch', async () => {
      const result = await processClaimBatch([]);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No claims to process');
    });

    it('should handle transaction failure', async () => {
      const mockClaim = {
        id: 'claim-1',
        walletAddress: 'userWallet123',
        claimStatus: 'pending',
      };

      (prisma.usersClaim.update as jest.Mock).mockResolvedValue(mockClaim);
      (prisma.usersClaim.findUnique as jest.Mock).mockResolvedValue(mockClaim);
      (connection.getAccountInfo as jest.Mock).mockRejectedValue(new Error('Network error'));
      (prisma.transaction.create as jest.Mock).mockResolvedValue({});

      const result = await processClaimBatch([mockClaimJob]);

      expect(result.success).toBe(false);
      expect(result.error).toBeTruthy();
    });

    it('should create associated token account if needed', async () => {
      const mockClaim = {
        id: 'claim-1',
        walletAddress: 'userWallet123',
        claimStatus: 'pending',
      };

      (prisma.usersClaim.update as jest.Mock).mockResolvedValue(mockClaim);
      (prisma.usersClaim.findUnique as jest.Mock).mockResolvedValue(mockClaim);
      (connection.getAccountInfo as jest.Mock).mockResolvedValue(null); // Account doesn't exist
      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);

      const result = await processClaimBatch([mockClaimJob]);

      expect(result.success).toBe(true);
    });

    it('should update claim status to failed on error', async () => {
      const mockClaim = {
        id: 'claim-1',
        walletAddress: 'userWallet123',
        claimStatus: 'pending',
      };

      (prisma.usersClaim.update as jest.Mock).mockResolvedValue(mockClaim);
      (prisma.usersClaim.findUnique as jest.Mock).mockResolvedValue(mockClaim);
      (connection.getAccountInfo as jest.Mock).mockRejectedValue(new Error('Transaction failed'));
      (prisma.transaction.create as jest.Mock).mockResolvedValue({});

      const result = await processClaimBatch([mockClaimJob]);

      expect(result.success).toBe(false);
      expect(prisma.usersClaim.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            claimStatus: 'failed',
            retryCount: { increment: 1 },
          }),
        })
      );
    });

    it('should log transaction in database', async () => {
      const mockClaim = {
        id: 'claim-1',
        walletAddress: 'userWallet123',
        claimStatus: 'pending',
      };

      (prisma.usersClaim.update as jest.Mock).mockResolvedValue(mockClaim);
      (prisma.usersClaim.findUnique as jest.Mock).mockResolvedValue(mockClaim);
      (connection.getAccountInfo as jest.Mock).mockResolvedValue({});
      (prisma.$transaction as jest.Mock).mockResolvedValue([{}, {}]);

      await processClaimBatch([mockClaimJob]);

      expect(prisma.$transaction).toHaveBeenCalled();
    });
  });

  describe('confirmTransaction', () => {
    it('should confirm valid transaction', async () => {
      (connection.confirmTransaction as jest.Mock).mockResolvedValue({
        value: { err: null },
      });

      const result = await confirmTransaction('validSignature');

      expect(result).toBe(true);
      expect(connection.confirmTransaction).toHaveBeenCalledWith(
        'validSignature',
        'confirmed'
      );
    });

    it('should return false for failed transaction', async () => {
      (connection.confirmTransaction as jest.Mock).mockResolvedValue({
        value: { err: 'Transaction failed' },
      });

      const result = await confirmTransaction('failedSignature');

      expect(result).toBe(false);
    });

    it('should handle confirmation errors', async () => {
      (connection.confirmTransaction as jest.Mock).mockRejectedValue(
        new Error('Network error')
      );

      const result = await confirmTransaction('errorSignature');

      expect(result).toBe(false);
    });
  });
});
