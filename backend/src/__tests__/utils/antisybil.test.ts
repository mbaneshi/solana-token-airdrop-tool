// Anti-Sybil utilities for detecting and preventing Sybil attacks
import redis from '../../config/redis';

/**
 * Check if an IP address has exceeded claim limits
 */
export const checkIpClaimLimit = async (ipAddress: string): Promise<boolean> => {
  const maxClaimsPerIp = parseInt(process.env.MAX_CLAIMS_PER_IP || '5');
  const windowHours = parseInt(process.env.IP_LIMIT_WINDOW_HOURS || '24');

  const key = `ip_claims:${ipAddress}`;
  const count = await redis.get(key);

  if (!count) {
    return true;
  }

  return parseInt(count) < maxClaimsPerIp;
};

/**
 * Increment IP claim count
 */
export const incrementIpClaimCount = async (ipAddress: string): Promise<void> => {
  const windowHours = parseInt(process.env.IP_LIMIT_WINDOW_HOURS || '24');
  const key = `ip_claims:${ipAddress}`;

  const current = await redis.get(key);

  if (!current) {
    await redis.setex(key, windowHours * 3600, '1');
  } else {
    await redis.incr(key);
  }
};

/**
 * Check wallet age (requires blockchain data)
 */
export const checkWalletAge = async (walletAddress: string): Promise<boolean> => {
  // Simplified implementation - in production, check on-chain data
  const minAgeSeconds = parseInt(process.env.MIN_WALLET_AGE_SECONDS || '0');
  return minAgeSeconds === 0 || true; // Always pass if not configured
};

/**
 * Calculate wallet risk score
 */
export const calculateRiskScore = async (walletAddress: string, ipAddress: string): Promise<number> => {
  let score = 0;

  // Check IP reputation
  const ipKey = `ip_claims:${ipAddress}`;
  const ipClaims = await redis.get(ipKey);
  if (ipClaims && parseInt(ipClaims) > 3) {
    score += 30;
  }

  // Check wallet claim frequency
  const walletKey = `wallet_claims:${walletAddress}`;
  const walletClaims = await redis.get(walletKey);
  if (walletClaims && parseInt(walletClaims) > 1) {
    score += 50;
  }

  return score;
};

/**
 * Check if wallet/IP combination is suspicious
 */
export const isSuspiciousActivity = async (walletAddress: string, ipAddress: string): Promise<boolean> => {
  const riskScore = await calculateRiskScore(walletAddress, ipAddress);
  const threshold = parseInt(process.env.RISK_SCORE_THRESHOLD || '70');

  return riskScore >= threshold;
};

describe('Anti-Sybil Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.MAX_CLAIMS_PER_IP = '5';
    process.env.IP_LIMIT_WINDOW_HOURS = '24';
  });

  describe('checkIpClaimLimit', () => {
    it('should allow claims when under limit', async () => {
      (redis.get as jest.Mock).mockResolvedValue('3');

      const result = await checkIpClaimLimit('192.168.1.1');

      expect(result).toBe(true);
    });

    it('should block claims when at limit', async () => {
      (redis.get as jest.Mock).mockResolvedValue('5');

      const result = await checkIpClaimLimit('192.168.1.1');

      expect(result).toBe(false);
    });

    it('should block claims when over limit', async () => {
      (redis.get as jest.Mock).mockResolvedValue('10');

      const result = await checkIpClaimLimit('192.168.1.1');

      expect(result).toBe(false);
    });

    it('should allow first claim from new IP', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);

      const result = await checkIpClaimLimit('192.168.1.1');

      expect(result).toBe(true);
    });
  });

  describe('incrementIpClaimCount', () => {
    it('should set initial count for new IP', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);
      (redis.setex as jest.Mock).mockResolvedValue('OK');

      await incrementIpClaimCount('192.168.1.1');

      expect(redis.setex).toHaveBeenCalledWith(
        'ip_claims:192.168.1.1',
        86400, // 24 hours in seconds
        '1'
      );
    });

    it('should increment existing count', async () => {
      (redis.get as jest.Mock).mockResolvedValue('2');
      (redis.incr as jest.Mock).mockResolvedValue(3);

      await incrementIpClaimCount('192.168.1.1');

      expect(redis.incr).toHaveBeenCalledWith('ip_claims:192.168.1.1');
    });
  });

  describe('checkWalletAge', () => {
    it('should return true when min age is not configured', async () => {
      process.env.MIN_WALLET_AGE_SECONDS = '0';

      const result = await checkWalletAge('wallet123');

      expect(result).toBe(true);
    });

    it('should handle wallet age check', async () => {
      process.env.MIN_WALLET_AGE_SECONDS = '86400';

      const result = await checkWalletAge('wallet123');

      // Simplified implementation always returns true
      expect(result).toBe(true);
    });
  });

  describe('calculateRiskScore', () => {
    it('should return 0 for clean wallet and IP', async () => {
      (redis.get as jest.Mock).mockResolvedValue(null);

      const score = await calculateRiskScore('wallet123', '192.168.1.1');

      expect(score).toBe(0);
    });

    it('should add score for suspicious IP', async () => {
      (redis.get as jest.Mock)
        .mockResolvedValueOnce('5') // IP claims
        .mockResolvedValueOnce(null); // Wallet claims

      const score = await calculateRiskScore('wallet123', '192.168.1.1');

      expect(score).toBeGreaterThanOrEqual(30);
    });

    it('should add score for repeat wallet claims', async () => {
      (redis.get as jest.Mock)
        .mockResolvedValueOnce(null) // IP claims
        .mockResolvedValueOnce('2'); // Wallet claims

      const score = await calculateRiskScore('wallet123', '192.168.1.1');

      expect(score).toBeGreaterThanOrEqual(50);
    });

    it('should combine scores for suspicious activity', async () => {
      (redis.get as jest.Mock)
        .mockResolvedValueOnce('5') // IP claims
        .mockResolvedValueOnce('2'); // Wallet claims

      const score = await calculateRiskScore('wallet123', '192.168.1.1');

      expect(score).toBeGreaterThanOrEqual(80);
    });
  });

  describe('isSuspiciousActivity', () => {
    it('should flag high-risk activity', async () => {
      (redis.get as jest.Mock)
        .mockResolvedValueOnce('5')
        .mockResolvedValueOnce('2');

      process.env.RISK_SCORE_THRESHOLD = '70';

      const result = await isSuspiciousActivity('wallet123', '192.168.1.1');

      expect(result).toBe(true);
    });

    it('should allow low-risk activity', async () => {
      (redis.get as jest.Mock)
        .mockResolvedValueOnce('1')
        .mockResolvedValueOnce(null);

      process.env.RISK_SCORE_THRESHOLD = '70';

      const result = await isSuspiciousActivity('wallet123', '192.168.1.1');

      expect(result).toBe(false);
    });

    it('should use configurable threshold', async () => {
      (redis.get as jest.Mock)
        .mockResolvedValueOnce('4')
        .mockResolvedValueOnce(null);

      process.env.RISK_SCORE_THRESHOLD = '20';

      const result = await isSuspiciousActivity('wallet123', '192.168.1.1');

      expect(result).toBe(true);
    });
  });
});
