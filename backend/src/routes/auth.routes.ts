import express from 'express';
import { generateNonce, verifySignature, generateToken } from '../services/auth.service';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = express.Router();

/**
 * GET /api/v1/auth/nonce
 * Generate nonce for wallet authentication
 */
router.post('/nonce', async (req, res, next) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      throw new AppError('Wallet address is required', 400);
    }

    const nonce = await generateNonce(walletAddress);

    res.json({
      success: true,
      nonce,
      message: `Sign this message to authenticate: Airdrop Platform Authentication\nWallet: ${walletAddress}\nNonce: ${nonce}\nTimestamp: ${Date.now()}`,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/verify
 * Verify wallet signature and issue JWT
 */
router.post('/verify', async (req, res, next) => {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      throw new AppError('Missing required fields', 400);
    }

    const isValid = await verifySignature(walletAddress, signature, message);

    if (!isValid) {
      throw new AppError('Invalid signature', 401);
    }

    const token = generateToken(walletAddress);

    logger.info(`User authenticated: ${walletAddress}`);

    res.json({
      success: true,
      token,
      walletAddress,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
