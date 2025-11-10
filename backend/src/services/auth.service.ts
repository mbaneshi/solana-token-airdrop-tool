import jwt from 'jsonwebtoken';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { logger } from '../utils/logger';
import redis from '../config/redis';
import bs58 from 'bs58';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '24h';

export interface AuthPayload {
  walletAddress: string;
  nonce: string;
  timestamp: number;
}

/**
 * Generate a nonce for wallet authentication
 */
export const generateNonce = async (walletAddress: string): Promise<string> => {
  const nonce = Math.random().toString(36).substring(2, 15);
  const timestamp = Date.now();

  // Store nonce in Redis with 15-minute expiration
  await redis.setex(`nonce:${walletAddress}`, 900, JSON.stringify({ nonce, timestamp }));

  return nonce;
};

/**
 * Verify wallet signature
 */
export const verifySignature = async (
  walletAddress: string,
  signature: string,
  message: string
): Promise<boolean> => {
  try {
    // Get stored nonce
    const storedData = await redis.get(`nonce:${walletAddress}`);

    if (!storedData) {
      logger.warn(`No nonce found for wallet ${walletAddress}`);
      return false;
    }

    const { nonce, timestamp } = JSON.parse(storedData);

    // Check if nonce is expired (15 minutes)
    if (Date.now() - timestamp > 900000) {
      logger.warn(`Expired nonce for wallet ${walletAddress}`);
      await redis.del(`nonce:${walletAddress}`);
      return false;
    }

    // Verify message contains nonce
    if (!message.includes(nonce)) {
      logger.warn(`Message does not contain nonce for wallet ${walletAddress}`);
      return false;
    }

    // Verify signature
    const publicKey = new PublicKey(walletAddress);
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = bs58.decode(signature);

    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKey.toBytes()
    );

    if (isValid) {
      // Delete used nonce
      await redis.del(`nonce:${walletAddress}`);
    }

    return isValid;
  } catch (error) {
    logger.error('Error verifying signature:', error);
    return false;
  }
};

/**
 * Generate JWT token
 */
export const generateToken = (walletAddress: string): string => {
  const payload: AuthPayload = {
    walletAddress,
    nonce: Math.random().toString(36).substring(2, 15),
    timestamp: Date.now(),
  };

  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
};

/**
 * Verify JWT token
 */
export const verifyToken = (token: string): AuthPayload | null => {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    return decoded;
  } catch (error) {
    logger.error('Error verifying token:', error);
    return null;
  }
};

/**
 * Check if wallet is admin
 */
export const isAdminWallet = (walletAddress: string): boolean => {
  const adminWallets = (process.env.ADMIN_WALLETS || '').split(',').map((w) => w.trim());
  return adminWallets.includes(walletAddress);
};
