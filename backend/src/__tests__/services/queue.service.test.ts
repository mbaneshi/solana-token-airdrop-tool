import { Queue, Worker } from 'bullmq';
import { addClaimToQueue, getQueueMetrics, pauseQueue, resumeQueue } from '../../queue/claimQueue';

// Mock BullMQ
jest.mock('bullmq', () => {
  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    getWaitingCount: jest.fn().mockResolvedValue(5),
    getActiveCount: jest.fn().mockResolvedValue(2),
    getCompletedCount: jest.fn().mockResolvedValue(100),
    getFailedCount: jest.fn().mockResolvedValue(3),
    getDelayedCount: jest.fn().mockResolvedValue(1),
  };

  const mockWorker = {
    on: jest.fn(),
  };

  return {
    Queue: jest.fn(() => mockQueue),
    Worker: jest.fn(() => mockWorker),
  };
});

describe('Queue Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('addClaimToQueue', () => {
    it('should add claim to queue successfully', async () => {
      const claimData = {
        claimId: 'claim-1',
        walletAddress: 'wallet123',
        amount: 100000000000,
      };

      const result = await addClaimToQueue(claimData);

      expect(result).toBeDefined();
      expect(result.id).toBe('job-1');
    });

    it('should use claim ID as job ID', async () => {
      const claimData = {
        claimId: 'claim-unique-123',
        walletAddress: 'wallet123',
        amount: 100000000000,
      };

      await addClaimToQueue(claimData);

      const mockQueue = (Queue as jest.MockedClass<typeof Queue>).mock.results[0].value;
      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-claim',
        claimData,
        { jobId: 'claim-unique-123' }
      );
    });

    it('should handle large amounts', async () => {
      const claimData = {
        claimId: 'claim-2',
        walletAddress: 'wallet456',
        amount: Number.MAX_SAFE_INTEGER,
      };

      const result = await addClaimToQueue(claimData);

      expect(result).toBeDefined();
    });
  });

  describe('getQueueMetrics', () => {
    it('should return queue metrics', async () => {
      const metrics = await getQueueMetrics();

      expect(metrics).toEqual({
        waiting: 5,
        active: 2,
        completed: 100,
        failed: 3,
        delayed: 1,
      });
    });

    it('should call all counter methods', async () => {
      const mockQueue = (Queue as jest.MockedClass<typeof Queue>).mock.results[0].value;

      await getQueueMetrics();

      expect(mockQueue.getWaitingCount).toHaveBeenCalled();
      expect(mockQueue.getActiveCount).toHaveBeenCalled();
      expect(mockQueue.getCompletedCount).toHaveBeenCalled();
      expect(mockQueue.getFailedCount).toHaveBeenCalled();
      expect(mockQueue.getDelayedCount).toHaveBeenCalled();
    });

    it('should handle zero counts', async () => {
      const mockQueue = (Queue as jest.MockedClass<typeof Queue>).mock.results[0].value;
      mockQueue.getWaitingCount.mockResolvedValue(0);
      mockQueue.getActiveCount.mockResolvedValue(0);
      mockQueue.getCompletedCount.mockResolvedValue(0);
      mockQueue.getFailedCount.mockResolvedValue(0);
      mockQueue.getDelayedCount.mockResolvedValue(0);

      const metrics = await getQueueMetrics();

      expect(metrics).toEqual({
        waiting: 0,
        active: 0,
        completed: 0,
        failed: 0,
        delayed: 0,
      });
    });
  });

  describe('pauseQueue', () => {
    it('should pause the queue', async () => {
      const mockQueue = (Queue as jest.MockedClass<typeof Queue>).mock.results[0].value;

      await pauseQueue();

      expect(mockQueue.pause).toHaveBeenCalled();
    });
  });

  describe('resumeQueue', () => {
    it('should resume the queue', async () => {
      const mockQueue = (Queue as jest.MockedClass<typeof Queue>).mock.results[0].value;

      await resumeQueue();

      expect(mockQueue.resume).toHaveBeenCalled();
    });
  });

  describe('Worker Configuration', () => {
    it('should create worker with event listeners', () => {
      const mockWorker = (Worker as jest.MockedClass<typeof Worker>).mock.results[0].value;

      expect(mockWorker.on).toHaveBeenCalledWith('completed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('failed', expect.any(Function));
      expect(mockWorker.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should configure retry attempts', () => {
      const QueueConstructor = Queue as jest.MockedClass<typeof Queue>;
      const queueOptions = QueueConstructor.mock.calls[0][1];

      expect(queueOptions?.defaultJobOptions?.attempts).toBeDefined();
    });

    it('should configure exponential backoff', () => {
      const QueueConstructor = Queue as jest.MockedClass<typeof Queue>;
      const queueOptions = QueueConstructor.mock.calls[0][1];

      expect(queueOptions?.defaultJobOptions?.backoff?.type).toBe('exponential');
    });
  });
});
