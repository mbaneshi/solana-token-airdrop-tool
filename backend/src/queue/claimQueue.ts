import { Queue, Worker, Job } from 'bullmq';
import redis from '../config/redis';
import { logger } from '../utils/logger';
import { processClaimBatch } from '../services/distribution.service';

export interface ClaimJob {
  claimId: string;
  walletAddress: string;
  amount: number;
}

// Create claim queue
export const claimQueue = new Queue<ClaimJob>('claim-processing', {
  connection: redis,
  defaultJobOptions: {
    attempts: parseInt(process.env.MAX_RETRY_ATTEMPTS || '3'),
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: {
      count: 1000,
      age: 24 * 3600, // 24 hours
    },
    removeOnFail: {
      count: 5000,
    },
  },
});

// Create worker
export const claimWorker = new Worker<ClaimJob>(
  'claim-processing',
  async (job: Job<ClaimJob>) => {
    const { claimId, walletAddress, amount } = job.data;

    logger.info(`Processing claim job ${job.id} for wallet ${walletAddress}`);

    try {
      const result = await processClaimBatch([job.data]);

      if (result.success) {
        logger.info(`✅ Claim ${claimId} processed successfully`);
        return result;
      } else {
        throw new Error(result.error || 'Failed to process claim');
      }
    } catch (error: any) {
      logger.error(`❌ Failed to process claim ${claimId}:`, error);
      throw error;
    }
  },
  {
    connection: redis,
    concurrency: parseInt(process.env.QUEUE_CONCURRENCY || '5'),
  }
);

// Event listeners
claimWorker.on('completed', (job) => {
  logger.info(`Job ${job.id} completed successfully`);
});

claimWorker.on('failed', (job, err) => {
  logger.error(`Job ${job?.id} failed:`, err);
});

claimWorker.on('error', (err) => {
  logger.error('Worker error:', err);
});

// Add claim to queue
export const addClaimToQueue = async (claimData: ClaimJob): Promise<Job<ClaimJob>> => {
  return await claimQueue.add('process-claim', claimData, {
    jobId: claimData.claimId,
  });
};

// Get queue metrics
export const getQueueMetrics = async () => {
  const [waiting, active, completed, failed, delayed] = await Promise.all([
    claimQueue.getWaitingCount(),
    claimQueue.getActiveCount(),
    claimQueue.getCompletedCount(),
    claimQueue.getFailedCount(),
    claimQueue.getDelayedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
  };
};

// Pause queue
export const pauseQueue = async (): Promise<void> => {
  await claimQueue.pause();
  logger.info('Queue paused');
};

// Resume queue
export const resumeQueue = async (): Promise<void> => {
  await claimQueue.resume();
  logger.info('Queue resumed');
};

logger.info('✅ Claim queue and worker initialized');
