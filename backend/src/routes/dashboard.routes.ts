import express from 'express';
import prisma from '../config/database';
import { getQueueMetrics } from '../queue/claimQueue';

const router = express.Router();

/**
 * GET /api/v1/dashboard/metrics
 * Get dashboard metrics
 */
router.get('/metrics', async (req, res, next) => {
  try {
    // Get active airdrop
    const airdrop = await prisma.airdrop.findFirst({
      where: { status: 'active' },
    });

    if (!airdrop) {
      return res.json({
        success: true,
        metrics: {
          totalSupply: 0,
          tokensDistributed: 0,
          tokensRemaining: 0,
          totalClaims: 0,
          successfulClaims: 0,
          failedClaims: 0,
          pendingClaims: 0,
          successRate: 0,
        },
      });
    }

    // Get claim statistics
    const [totalClaims, successfulClaims, failedClaims, pendingClaims] = await Promise.all([
      prisma.usersClaim.count(),
      prisma.usersClaim.count({ where: { claimStatus: 'completed' } }),
      prisma.usersClaim.count({ where: { claimStatus: 'failed' } }),
      prisma.usersClaim.count({ where: { claimStatus: 'pending' } }),
    ]);

    const successRate = totalClaims > 0 ? (successfulClaims / totalClaims) * 100 : 0;

    // Get queue metrics
    const queueMetrics = await getQueueMetrics();

    res.json({
      success: true,
      metrics: {
        totalSupply: airdrop.totalSupply.toString(),
        tokensDistributed: airdrop.tokensDistributed.toString(),
        tokensRemaining: (
          Number(airdrop.totalSupply) - Number(airdrop.tokensDistributed)
        ).toString(),
        totalClaims,
        successfulClaims,
        failedClaims,
        pendingClaims,
        successRate: successRate.toFixed(2),
        queue: queueMetrics,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/dashboard/claims
 * Get recent claims
 */
router.get('/claims', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;

    const claims = await prisma.usersClaim.findMany({
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const total = await prisma.usersClaim.count();

    res.json({
      success: true,
      claims: claims.map((claim) => ({
        id: claim.id,
        walletAddress: claim.walletAddress,
        status: claim.claimStatus,
        amount: claim.tokensClaimed.toString(),
        claimedAt: claim.claimedAt,
        transactionSignature: claim.transactionSignature,
      })),
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/dashboard/stats
 * Get statistics over time
 */
router.get('/stats', async (req, res, next) => {
  try {
    const days = parseInt(req.query.days as string) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get claims grouped by day
    const claimsByDay = await prisma.$queryRaw<
      Array<{ date: Date; count: bigint }>
    >`
      SELECT DATE(claimed_at) as date, COUNT(*) as count
      FROM users_claims
      WHERE claimed_at >= ${startDate}
      GROUP BY DATE(claimed_at)
      ORDER BY date ASC
    `;

    // Get average claim time
    const completedClaims = await prisma.usersClaim.findMany({
      where: {
        claimStatus: 'completed',
        claimedAt: { not: null },
        createdAt: { gte: startDate },
      },
      select: {
        createdAt: true,
        claimedAt: true,
      },
    });

    const avgClaimTime =
      completedClaims.reduce((acc, claim) => {
        if (claim.claimedAt) {
          return acc + (claim.claimedAt.getTime() - claim.createdAt.getTime());
        }
        return acc;
      }, 0) /
      (completedClaims.length || 1);

    res.json({
      success: true,
      stats: {
        claimsByDay: claimsByDay.map((row) => ({
          date: row.date,
          count: Number(row.count),
        })),
        averageClaimTimeSeconds: Math.round(avgClaimTime / 1000),
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
