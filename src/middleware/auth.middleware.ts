import { Response, NextFunction } from 'express';
import { AuthenticatedRequest, JwtPayload } from '../types';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt';
import { prisma } from '../config/database';
import { UserRole, UserStatus } from '@prisma/client';
import { logger } from '../config/logger';

/**
 * Authentication middleware
 * Verifies JWT token and attaches user to request
 */
export async function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (!token) {
      res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
      return;
    }

    // Verify token
    let payload: JwtPayload;
    try {
      payload = verifyToken(token);
    } catch (error) {
      res.status(401).json({
        success: false,
        error: 'Invalid or expired token',
      });
      return;
    }

    // Check if user still exists and is active
    const user = await prisma.user.findUnique({
      where: { id: payload.id },
    });

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'User not found',
      });
      return;
    }

    if (user.status !== UserStatus.active) {
      res.status(401).json({
        success: false,
        error: 'User account is not active',
      });
      return;
    }

    // Attach user to request
    req.user = payload;

    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(500).json({
      success: false,
      error: 'Authentication failed',
    });
  }
}

/**
 * Authorization middleware for admin-only routes
 */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
    return;
  }

  if (req.user.role !== UserRole.admin) {
    res.status(403).json({
      success: false,
      error: 'Admin access required',
    });
    return;
  }

  next();
}

/**
 * Optional authentication - doesn't fail if no token
 */
export async function optionalAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const token = extractTokenFromHeader(req.headers.authorization);

    if (token) {
      try {
        const payload = verifyToken(token);
        req.user = payload;
      } catch {
        // Token invalid but we don't fail - just continue without user
      }
    }

    next();
  } catch (error) {
    next();
  }
}
