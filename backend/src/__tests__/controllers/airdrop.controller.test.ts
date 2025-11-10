import request from 'supertest';
import express from 'express';
import adminRoutes from '../../routes/admin.routes';
import prisma from '../../config/database';

// Mock admin authentication
jest.mock('../../middleware/auth', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { walletAddress: process.env.ADMIN_WALLETS?.split(',')[0] || 'adminWallet' };
    next();
  },
  requireAdmin: (req: any, res: any, next: any) => next(),
}));

describe('Airdrop Controller', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/v1/admin', adminRoutes);
    app.use((err: any, req: any, res: any, next: any) => {
      res.status(err.statusCode || 500).json({ message: err.message });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/v1/admin/airdrop', () => {
    it('should create a new airdrop', async () => {
      const mockAirdrop = {
        id: 'airdrop-1',
        name: 'Test Airdrop',
        tokenMint: '11111111111111111111111111111111',
        totalSupply: BigInt(1000000),
        tokensPerClaim: BigInt(100),
        status: 'scheduled',
      };

      (prisma.airdrop.create as jest.Mock).mockResolvedValue(mockAirdrop);

      const response = await request(app)
        .post('/api/v1/admin/airdrop')
        .send({
          name: 'Test Airdrop',
          tokenMint: '11111111111111111111111111111111',
          totalSupply: '1000000',
          tokensPerClaim: '100',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v1/admin/airdrop')
        .send({
          name: 'Test Airdrop',
          // Missing required fields
        });

      expect(response.status).toBe(400);
    });
  });

  describe('PUT /api/v1/admin/airdrop/:id/pause', () => {
    it('should pause an active airdrop', async () => {
      const mockAirdrop = {
        id: 'airdrop-1',
        status: 'paused',
      };

      (prisma.airdrop.update as jest.Mock).mockResolvedValue(mockAirdrop);

      const response = await request(app)
        .put('/api/v1/admin/airdrop/airdrop-1/pause');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('PUT /api/v1/admin/airdrop/:id/resume', () => {
    it('should resume a paused airdrop', async () => {
      const mockAirdrop = {
        id: 'airdrop-1',
        status: 'active',
      };

      (prisma.airdrop.update as jest.Mock).mockResolvedValue(mockAirdrop);

      const response = await request(app)
        .put('/api/v1/admin/airdrop/airdrop-1/resume');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/admin/whitelist', () => {
    it('should add wallets to whitelist', async () => {
      (prisma.whitelist.createMany as jest.Mock).mockResolvedValue({ count: 2 });

      const response = await request(app)
        .post('/api/v1/admin/whitelist')
        .send({
          airdropId: 'airdrop-1',
          wallets: ['wallet1', 'wallet2'],
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('POST /api/v1/admin/blacklist', () => {
    it('should add wallet to blacklist', async () => {
      const mockBlacklist = {
        walletAddress: 'badWallet',
        reason: 'Suspicious activity',
      };

      (prisma.blacklist.create as jest.Mock).mockResolvedValue(mockBlacklist);

      const response = await request(app)
        .post('/api/v1/admin/blacklist')
        .send({
          walletAddress: 'badWallet',
          reason: 'Suspicious activity',
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v1/admin/claims', () => {
    it('should return paginated claims', async () => {
      const mockClaims = [
        {
          id: 'claim-1',
          walletAddress: 'wallet1',
          claimStatus: 'completed',
        },
        {
          id: 'claim-2',
          walletAddress: 'wallet2',
          claimStatus: 'pending',
        },
      ];

      (prisma.usersClaim.findMany as jest.Mock).mockResolvedValue(mockClaims);
      (prisma.usersClaim.count as jest.Mock).mockResolvedValue(2);

      const response = await request(app)
        .get('/api/v1/admin/claims')
        .query({ limit: 10, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body.claims).toHaveLength(2);
    });
  });

  describe('GET /api/v1/admin/analytics', () => {
    it('should return analytics data', async () => {
      const mockMetrics = {
        totalClaims: 100,
        successfulClaims: 95,
        failedClaims: 5,
      };

      (prisma.usersClaim.count as jest.Mock)
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(95)
        .mockResolvedValueOnce(5);

      const response = await request(app)
        .get('/api/v1/admin/analytics');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });
});
