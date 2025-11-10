import request from 'supertest';
import express from 'express';
import claimRoutes from '../../routes/claim.routes';
import prisma from '../../config/database';
import { addClaimToQueue } from '../../queue/claimQueue';

// Mock dependencies
jest.mock('../../queue/claimQueue');
jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { walletAddress: 'testWallet123' };
    next();
  },
  AuthRequest: {},
}));
jest.mock('../../middleware/rateLimiter', () => ({
  claimLimiter: (req: any, res: any, next: any) => next(),
  checkIpClaimLimit: jest.fn().mockResolvedValue(true),
  incrementIpClaimCount: jest.fn().mockResolvedValue(true),
}));

describe('Claim Controller', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/claim', claimRoutes);
    app.use((err: any, req: any, res: any, next: any) => {
      res.status(err.statusCode || 500).json({ message: err.message });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/claim', () => {
    it('should successfully create a claim', async () => {
      const mockAirdrop = {
        id: 'airdrop-1',
        status: 'active',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2025-01-01'),
        whitelistOnly: false,
        totalSupply: BigInt(1000000),
        tokensDistributed: BigInt(0),
        tokensPerClaim: BigInt(100),
      };

      const mockClaim = {
        id: 'claim-1',
        walletAddress: 'testWallet123',
        claimStatus: 'pending',
        tokensClaimed: BigInt(100),
      };

      (prisma.blacklist.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.usersClaim.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.airdrop.findFirst as jest.Mock).mockResolvedValue(mockAirdrop);
      (prisma.usersClaim.create as jest.Mock).mockResolvedValue(mockClaim);
      (addClaimToQueue as jest.Mock).mockResolvedValue({});

      const response = await request(app)
        .post('/api/v1/claim')
        .send({});

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.claimId).toBe('claim-1');
    });

    it('should reject blacklisted wallet', async () => {
      (prisma.blacklist.findUnique as jest.Mock).mockResolvedValue({
        walletAddress: 'testWallet123',
        reason: 'Suspicious activity',
      });

      const response = await request(app)
        .post('/api/v1/claim')
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('blacklisted');
    });

    it('should reject duplicate claims', async () => {
      (prisma.blacklist.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.usersClaim.findUnique as jest.Mock).mockResolvedValue({
        id: 'existing-claim',
        walletAddress: 'testWallet123',
      });

      const response = await request(app)
        .post('/api/v1/claim')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('already claimed');
    });

    it('should check whitelist when in whitelist-only mode', async () => {
      const mockAirdrop = {
        id: 'airdrop-1',
        status: 'active',
        startDate: new Date('2024-01-01'),
        endDate: null,
        whitelistOnly: true,
        totalSupply: BigInt(1000000),
        tokensDistributed: BigInt(0),
        tokensPerClaim: BigInt(100),
      };

      (prisma.blacklist.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.usersClaim.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.airdrop.findFirst as jest.Mock).mockResolvedValue(mockAirdrop);
      (prisma.whitelist.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/claim')
        .send({});

      expect(response.status).toBe(403);
      expect(response.body.message).toContain('not whitelisted');
    });

    it('should reject when no active airdrop exists', async () => {
      (prisma.blacklist.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.usersClaim.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.airdrop.findFirst as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .post('/api/v1/claim')
        .send({});

      expect(response.status).toBe(404);
      expect(response.body.message).toContain('No active airdrop');
    });

    it('should reject when supply is exhausted', async () => {
      const mockAirdrop = {
        id: 'airdrop-1',
        status: 'active',
        startDate: new Date('2024-01-01'),
        endDate: null,
        whitelistOnly: false,
        totalSupply: BigInt(1000),
        tokensDistributed: BigInt(950),
        tokensPerClaim: BigInt(100),
      };

      (prisma.blacklist.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.usersClaim.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.airdrop.findFirst as jest.Mock).mockResolvedValue(mockAirdrop);

      const response = await request(app)
        .post('/api/v1/claim')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.message).toContain('supply exhausted');
    });
  });

  describe('GET /api/v1/claim/:walletAddress', () => {
    it('should return claim status for existing claim', async () => {
      const mockClaim = {
        id: 'claim-1',
        walletAddress: 'testWallet123',
        claimStatus: 'completed',
        tokensClaimed: BigInt(100),
        claimedAt: new Date(),
        transactionSignature: 'signature123',
        transactions: [{
          id: 'tx-1',
          signature: 'signature123',
          status: 'confirmed',
        }],
      };

      (prisma.usersClaim.findUnique as jest.Mock).mockResolvedValue(mockClaim);

      const response = await request(app)
        .get('/api/v1/claim/testWallet123');

      expect(response.status).toBe(200);
      expect(response.body.hasClaimed).toBe(true);
      expect(response.body.claim.status).toBe('completed');
    });

    it('should return false for non-existent claim', async () => {
      (prisma.usersClaim.findUnique as jest.Mock).mockResolvedValue(null);

      const response = await request(app)
        .get('/api/v1/claim/testWallet123');

      expect(response.status).toBe(200);
      expect(response.body.hasClaimed).toBe(false);
    });
  });
});
