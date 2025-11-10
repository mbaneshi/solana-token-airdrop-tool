import express from 'express';
import prisma from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth';
import { claimLimiter, checkIpClaimLimit, incrementIpClaimCount } from '../middleware/rateLimiter';
import { AppError } from '../middleware/errorHandler';
import { addClaimToQueue } from '../queue/claimQueue';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * POST /api/v1/claim
 * Submit a claim request
 */
router.post('/', authenticate, claimLimiter, async (req: AuthRequest, res, next) => {
  try {
    const walletAddress = req.user!.walletAddress;
    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';

    // Check if wallet is blacklisted
    const blacklisted = await prisma.blacklist.findUnique({
      where: { walletAddress },
    });

    if (blacklisted) {
      throw new AppError('Wallet address is blacklisted', 403);
    }

    // Check if already claimed
    const existingClaim = await prisma.usersClaim.findUnique({
      where: { walletAddress },
    });

    if (existingClaim) {
      throw new AppError('You have already claimed tokens', 400);
    }

    // Check IP-based rate limit
    const ipAllowed = await checkIpClaimLimit(ipAddress);

    if (!ipAllowed) {
      throw new AppError('Too many claims from your IP address', 429);
    }

    // Get active airdrop
    const airdrop = await prisma.airdrop.findFirst({
      where: {
        status: 'active',
        startDate: { lte: new Date() },
        OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
      },
    });

    if (!airdrop) {
      throw new AppError('No active airdrop available', 404);
    }

    // Check if whitelist mode
    if (airdrop.whitelistOnly) {
      const whitelisted = await prisma.whitelist.findFirst({
        where: {
          walletAddress,
          airdropId: airdrop.id,
          eligible: true,
        },
      });

      if (!whitelisted) {
        throw new AppError('Wallet not whitelisted for this airdrop', 403);
      }
    }

    // Check remaining supply
    if (
      Number(airdrop.tokensDistributed) + Number(airdrop.tokensPerClaim) >
      Number(airdrop.totalSupply)
    ) {
      throw new AppError('Airdrop supply exhausted', 400);
    }

    // Create claim record
    const claim = await prisma.usersClaim.create({
      data: {
        walletAddress,
        claimStatus: 'pending',
        tokensClaimed: airdrop.tokensPerClaim,
        ipAddress,
        userAgent: req.get('user-agent') || null,
        authenticationMethod: 'signature',
      },
    });

    // Add to queue
    await addClaimToQueue({
      claimId: claim.id,
      walletAddress,
      amount: Number(airdrop.tokensPerClaim) * 1e9, // Convert to lamports
    });

    // Increment IP claim count
    await incrementIpClaimCount(ipAddress);

    logger.info(`Claim created for wallet ${walletAddress}`);

    res.json({
      success: true,
      message: 'Claim submitted successfully',
      claimId: claim.id,
      status: 'pending',
      estimatedWaitTime: '30-60 seconds',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/claim/:walletAddress
 * Get claim status
 */
router.get('/:walletAddress', async (req, res, next) => {
  try {
    const { walletAddress } = req.params;

    const claim = await prisma.usersClaim.findUnique({
      where: { walletAddress },
      include: {
        transactions: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!claim) {
      return res.json({
        success: true,
        hasClaimed: false,
      });
    }

    res.json({
      success: true,
      hasClaimed: true,
      claim: {
        status: claim.claimStatus,
        amount: claim.tokensClaimed.toString(),
        claimedAt: claim.claimedAt,
        transactionSignature: claim.transactionSignature,
        transaction: claim.transactions[0] || null,
      },
    });
  } catch (error) {
    next(error);
  }
});

export default router;
