/**
 * Auth Routes
 * Clean route definitions - all logic handled by controllers
 */

import { Router } from 'express';
import { body } from 'express-validator';
import { authController } from '../controllers';
import { authenticate, requireAdmin, asyncHandler } from '../middleware';

const router = Router();

// POST /auth/login - Login user
router.post(
  '/login',
  [
    body('userId').trim().notEmpty().withMessage('User ID is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  asyncHandler(authController.login)
);

// GET /auth/me - Get current user profile
router.get('/me', authenticate, asyncHandler(authController.getProfile));

// POST /auth/change-password - Change current user's password
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters'),
  ],
  asyncHandler(authController.changePassword)
);

// POST /auth/users - Create new user (admin only)
router.post(
  '/users',
  authenticate,
  requireAdmin,
  [
    body('userId').trim().notEmpty().withMessage('User ID is required'),
    body('fullName').trim().notEmpty().withMessage('Full name is required'),
    body('role').isIn(['admin', 'member']).withMessage('Invalid role'),
  ],
  asyncHandler(authController.createUser)
);

// GET /auth/users - Get all users (admin only)
router.get('/users', authenticate, requireAdmin, asyncHandler(authController.getAllUsers));

// POST /auth/users/:id/reset-password - Reset user password (admin only)
router.post(
  '/users/:id/reset-password',
  authenticate,
  requireAdmin,
  asyncHandler(authController.resetPassword)
);

// PATCH /auth/users/:id/status - Update user status (admin only)
router.patch(
  '/users/:id/status',
  authenticate,
  requireAdmin,
  [body('status').isIn(['active', 'inactive', 'suspended']).withMessage('Invalid status')],
  asyncHandler(authController.updateUserStatus)
);

// DELETE /auth/users/:id - Delete user (admin only)
router.delete('/users/:id', authenticate, requireAdmin, asyncHandler(authController.deleteUser));

export default router;
