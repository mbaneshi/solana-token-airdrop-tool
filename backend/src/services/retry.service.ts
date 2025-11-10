import prisma from '../config/database';
import { logger } from '../utils/logger';
import { addClaimToQueue } from '../queue/claimQueue';

interface RetryOptions {
  maxRetries?: number;
  batchSize?: number;
}

/**
 * Retry failed claims
 */
export const retryFailedClaims = async (options: RetryOptions = {}) => {
  const { maxRetries = 3, batchSize = 10 } = options;

  try {
    // Find failed claims that haven't exceeded retry limit
    const failedClaims = await prisma.usersClaim.findMany({
      where: {
        claimStatus: 'failed',
        retryCount: {
          lt: maxRetries,
        },
      },
      take: batchSize,
      orderBy: {
        updatedAt: 'asc',
      },
    });

    if (failedClaims.length === 0) {
      logger.info('No failed claims to retry');
      return { retriedCount: 0 };
    }

    logger.info(`Retrying ${failedClaims.length} failed claims`);

    let retriedCount = 0;

    for (const claim of failedClaims) {
      try {
        // Get airdrop details
        const airdrop = await prisma.airdrop.findFirst({
          where: {
            status: 'active',
          },
        });

        if (!airdrop) {
          logger.warn(`No active airdrop found for claim ${claim.id}`);
          continue;
        }

        // Reset claim status to pending
        await prisma.usersClaim.update({
          where: { id: claim.id },
          data: {
            claimStatus: 'pending',
          },
        });

        // Re-add to queue
        await addClaimToQueue({
          claimId: claim.id,
          walletAddress: claim.walletAddress,
          amount: Number(claim.tokensClaimed) * 1e9, // Convert to lamports
        });

        retriedCount++;
        logger.info(`Retried claim ${claim.id} for wallet ${claim.walletAddress}`);
      } catch (error) {
        logger.error(`Failed to retry claim ${claim.id}:`, error);

        // Increment retry count even on re-queue failure
        await prisma.usersClaim.update({
          where: { id: claim.id },
          data: {
            retryCount: { increment: 1 },
          },
        });
      }
    }

    return { retriedCount, totalFailed: failedClaims.length };
  } catch (error) {
    logger.error('Error in retryFailedClaims:', error);
    throw error;
  }
};

/**
 * Retry a specific failed claim
 */
export const retrySpecificClaim = async (claimId: string) => {
  try {
    const claim = await prisma.usersClaim.findUnique({
      where: { id: claimId },
    });

    if (!claim) {
      throw new Error('Claim not found');
    }

    if (claim.claimStatus !== 'failed') {
      throw new Error('Claim is not in failed status');
    }

    const maxRetries = parseInt(process.env.MAX_RETRY_ATTEMPTS || '3');
    if (claim.retryCount >= maxRetries) {
      throw new Error('Max retry attempts exceeded');
    }

    // Get airdrop details
    const airdrop = await prisma.airdrop.findFirst({
      where: {
        status: 'active',
      },
    });

    if (!airdrop) {
      throw new Error('No active airdrop found');
    }

    // Reset claim status
    await prisma.usersClaim.update({
      where: { id: claimId },
      data: {
        claimStatus: 'pending',
      },
    });

    // Re-add to queue
    await addClaimToQueue({
      claimId: claim.id,
      walletAddress: claim.walletAddress,
      amount: Number(claim.tokensClaimed) * 1e9,
    });

    logger.info(`Manually retried claim ${claimId}`);

    return { success: true, claimId };
  } catch (error) {
    logger.error(`Error retrying claim ${claimId}:`, error);
    throw error;
  }
};

/**
 * Get statistics about failed claims
 */
export const getFailedClaimsStats = async () => {
  try {
    const [totalFailed, retriableCount, maxRetriesCount] = await Promise.all([
      prisma.usersClaim.count({
        where: {
          claimStatus: 'failed',
        },
      }),
      prisma.usersClaim.count({
        where: {
          claimStatus: 'failed',
          retryCount: {
            lt: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3'),
          },
        },
      }),
      prisma.usersClaim.count({
        where: {
          claimStatus: 'failed',
          retryCount: {
            gte: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3'),
          },
        },
      }),
    ]);

    return {
      totalFailed,
      retriableCount,
      maxRetriesCount,
    };
  } catch (error) {
    logger.error('Error getting failed claims stats:', error);
    throw error;
  }
};

/**
 * Schedule automatic retry for failed claims
 * This should be called by a cron job or scheduler
 */
export const scheduleAutomaticRetry = async () => {
  try {
    logger.info('Running scheduled automatic retry...');

    const result = await retryFailedClaims({
      maxRetries: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3'),
      batchSize: parseInt(process.env.RETRY_BATCH_SIZE || '10'),
    });

    logger.info(`Automatic retry completed: ${result.retriedCount} claims retried`);

    return result;
  } catch (error) {
    logger.error('Error in scheduled automatic retry:', error);
    throw error;
  }
};
