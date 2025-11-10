import express from 'express';
import prisma from '../config/database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { pauseQueue, resumeQueue } from '../queue/claimQueue';
import { logger } from '../utils/logger';

const router = express.Router();

// All admin routes require authentication and admin privilege
router.use(authenticate);
router.use(requireAdmin);

/**
 * POST /api/v1/admin/airdrop
 * Create new airdrop
 */
router.post('/airdrop', async (req: AuthRequest, res, next) => {
  try {
    const {
      name,
      tokenMint,
      totalSupply,
      tokensPerClaim,
      startDate,
      endDate,
      whitelistOnly,
    } = req.body;

    const airdrop = await prisma.airdrop.create({
      data: {
        name,
        tokenMint,
        totalSupply,
        tokensPerClaim,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        status: 'scheduled',
        whitelistOnly: whitelistOnly || false,
      },
    });

    // Log admin action
    await prisma.adminAction.create({
      data: {
        adminWallet: req.user!.walletAddress,
        actionType: 'create_airdrop',
        targetEntity: airdrop.id,
        details: { name, totalSupply, tokensPerClaim },
      },
    });

    res.json({
      success: true,
      airdrop,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/admin/airdrop/:id/pause
 * Pause airdrop
 */
router.put('/airdrop/:id/pause', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const airdrop = await prisma.airdrop.update({
      where: { id },
      data: { status: 'paused' },
    });

    await pauseQueue();

    // Log admin action
    await prisma.adminAction.create({
      data: {
        adminWallet: req.user!.walletAddress,
        actionType: 'pause_airdrop',
        targetEntity: id,
      },
    });

    logger.info(`Airdrop ${id} paused by ${req.user!.walletAddress}`);

    res.json({
      success: true,
      message: 'Airdrop paused successfully',
      airdrop,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/admin/airdrop/:id/resume
 * Resume airdrop
 */
router.put('/airdrop/:id/resume', async (req: AuthRequest, res, next) => {
  try {
    const { id } = req.params;

    const airdrop = await prisma.airdrop.update({
      where: { id },
      data: { status: 'active' },
    });

    await resumeQueue();

    // Log admin action
    await prisma.adminAction.create({
      data: {
        adminWallet: req.user!.walletAddress,
        actionType: 'resume_airdrop',
        targetEntity: id,
      },
    });

    logger.info(`Airdrop ${id} resumed by ${req.user!.walletAddress}`);

    res.json({
      success: true,
      message: 'Airdrop resumed successfully',
      airdrop,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/admin/whitelist
 * Add wallets to whitelist
 */
router.post('/whitelist', async (req: AuthRequest, res, next) => {
  try {
    const { airdropId, wallets } = req.body;

    if (!Array.isArray(wallets) || wallets.length === 0) {
      throw new AppError('Wallets must be a non-empty array', 400);
    }

    const entries = await prisma.whitelist.createMany({
      data: wallets.map((wallet: string) => ({
        walletAddress: wallet,
        airdropId,
        eligible: true,
      })),
      skipDuplicates: true,
    });

    // Log admin action
    await prisma.adminAction.create({
      data: {
        adminWallet: req.user!.walletAddress,
        actionType: 'add_whitelist',
        targetEntity: airdropId,
        details: { count: wallets.length },
      },
    });

    res.json({
      success: true,
      message: `Added ${entries.count} wallets to whitelist`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/v1/admin/whitelist/:airdropId/:wallet
 * Remove wallet from whitelist
 */
router.delete('/whitelist/:airdropId/:wallet', async (req: AuthRequest, res, next) => {
  try {
    const { airdropId, wallet } = req.params;

    await prisma.whitelist.delete({
      where: {
        unique_wallet_airdrop: {
          walletAddress: wallet,
          airdropId,
        },
      },
    });

    // Log admin action
    await prisma.adminAction.create({
      data: {
        adminWallet: req.user!.walletAddress,
        actionType: 'remove_whitelist',
        targetEntity: airdropId,
        details: { wallet },
      },
    });

    res.json({
      success: true,
      message: 'Wallet removed from whitelist',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/admin/blacklist
 * Add wallet to blacklist
 */
router.post('/blacklist', async (req: AuthRequest, res, next) => {
  try {
    const { walletAddress, reason } = req.body;

    const blacklist = await prisma.blacklist.create({
      data: {
        walletAddress,
        reason,
        blockedBy: req.user!.walletAddress,
      },
    });

    // Log admin action
    await prisma.adminAction.create({
      data: {
        adminWallet: req.user!.walletAddress,
        actionType: 'add_blacklist',
        targetEntity: walletAddress,
        details: { reason },
      },
    });

    res.json({
      success: true,
      message: 'Wallet added to blacklist',
      blacklist,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admin/claims
 * Get all claims with filters
 */
router.get('/claims', async (req: AuthRequest, res, next) => {
  try {
    const { status, search, limit = '50', offset = '0' } = req.query;

    const where: any = {};

    if (status) {
      where.claimStatus = status;
    }

    if (search) {
      where.walletAddress = {
        contains: search as string,
      };
    }

    const [claims, total] = await Promise.all([
      prisma.usersClaim.findMany({
        where,
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
        orderBy: { createdAt: 'desc' },
        include: {
          transactions: true,
        },
      }),
      prisma.usersClaim.count({ where }),
    ]);

    res.json({
      success: true,
      claims,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        hasMore: parseInt(offset as string) + parseInt(limit as string) < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admin/export/claims
 * Export claims as CSV
 */
router.get('/export/claims', async (req: AuthRequest, res, next) => {
  try {
    const claims = await prisma.usersClaim.findMany({
      orderBy: { createdAt: 'desc' },
    });

    // Create CSV
    const header = 'Wallet Address,Status,Amount,Claimed At,Transaction Signature,IP Address\n';
    const rows = claims
      .map(
        (claim) =>
          `${claim.walletAddress},${claim.claimStatus},${claim.tokensClaimed},${
            claim.claimedAt || ''
          },${claim.transactionSignature || ''},${claim.ipAddress || ''}`
      )
      .join('\n');

    const csv = header + rows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=claims-${Date.now()}.csv`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admin/analytics
 * Get advanced analytics
 */
router.get('/analytics', async (req: AuthRequest, res, next) => {
  try {
    const [totalUsers, totalDistributed, avgClaimTime, topIps] = await Promise.all([
      prisma.usersClaim.count(),
      prisma.usersClaim.aggregate({
        _sum: {
          tokensClaimed: true,
        },
        where: {
          claimStatus: 'completed',
        },
      }),
      prisma.$queryRaw<Array<{ avg_time: number }>>`
        SELECT AVG(EXTRACT(EPOCH FROM (claimed_at - created_at))) as avg_time
        FROM users_claims
        WHERE claim_status = 'completed' AND claimed_at IS NOT NULL
      `,
      prisma.$queryRaw<Array<{ ip_address: string; count: bigint }>>`
        SELECT ip_address, COUNT(*) as count
        FROM users_claims
        WHERE ip_address IS NOT NULL
        GROUP BY ip_address
        ORDER BY count DESC
        LIMIT 10
      `,
    ]);

    res.json({
      success: true,
      analytics: {
        totalUsers,
        totalDistributed: totalDistributed._sum.tokensClaimed?.toString() || '0',
        averageClaimTimeSeconds: avgClaimTime[0]?.avg_time || 0,
        topIpAddresses: topIps.map((row) => ({
          ip: row.ip_address,
          claims: Number(row.count),
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
