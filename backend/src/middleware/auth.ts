import { Request, Response, NextFunction } from 'express';
import { verifyToken, isAdminWallet } from '../services/auth.service';
import { AppError } from './errorHandler';

export interface AuthRequest extends Request {
  user?: {
    walletAddress: string;
  };
}

/**
 * Authenticate user via JWT
 */
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('No authorization token provided', 401);
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);

    if (!payload) {
      throw new AppError('Invalid or expired token', 401);
    }

    req.user = {
      walletAddress: payload.walletAddress,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Check if user is admin
 */
export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AppError('Authentication required', 401);
    }

    if (!isAdminWallet(req.user.walletAddress)) {
      throw new AppError('Admin access required', 403);
    }

    next();
  } catch (error) {
    next(error);
  }
};
