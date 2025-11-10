import rateLimit from 'express-rate-limit';
import redis from '../config/redis';

// API rate limiter
export const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX || '100'),
  message: 'Too many requests from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
});

// Claim rate limiter (stricter)
export const claimLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: parseInt(process.env.IP_CLAIM_LIMIT || '5'),
  message: 'Too many claim attempts from this IP, please try again later',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
});

/**
 * Check IP-based claim limit
 */
export const checkIpClaimLimit = async (ipAddress: string): Promise<boolean> => {
  const key = `ip_claims:${ipAddress}`;
  const claims = await redis.get(key);
  const limit = parseInt(process.env.IP_CLAIM_LIMIT || '5');

  if (!claims) {
    return true;
  }

  return parseInt(claims) < limit;
};

/**
 * Increment IP claim count
 */
export const incrementIpClaimCount = async (ipAddress: string): Promise<void> => {
  const key = `ip_claims:${ipAddress}`;
  const windowHours = parseInt(process.env.IP_CLAIM_WINDOW_HOURS || '1');

  await redis.incr(key);
  await redis.expire(key, windowHours * 3600);
};
