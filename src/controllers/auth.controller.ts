/**
 * Auth Controller
 * Handles all authentication-related request/response logic
 */

import { Response } from 'express';
import { validationResult } from 'express-validator';
import { authService } from '../services';
import { AppError } from '../middleware';
import { AuthenticatedRequest } from '../types';

/**
 * POST /auth/login
 */
export const login = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 400);
  }

  const { userId, password } = req.body;
  const ipAddress = req.ip || req.socket.remoteAddress;

  const result = await authService.login({ userId, password }, ipAddress);

  res.json({
    success: true,
    data: result,
  });
};

/**
 * GET /auth/me
 */
export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const profile = await authService.getProfile(req.user!.id);

  res.json({
    success: true,
    data: profile,
  });
};

/**
 * POST /auth/change-password
 */
export const changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 400);
  }

  const { currentPassword, newPassword } = req.body;

  await authService.changePassword(req.user!.id, {
    currentPassword,
    newPassword,
  });

  res.json({
    success: true,
    message: 'Password changed successfully',
  });
};

/**
 * POST /auth/users
 */
export const createUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 400);
  }

  const result = await authService.createUser(req.body, req.user!.id);

  res.status(201).json({
    success: true,
    message: 'User created successfully',
    data: result,
  });
};

/**
 * GET /auth/users
 */
export const getAllUsers = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const users = await authService.getAllUsers();

  res.json({
    success: true,
    data: users,
  });
};

/**
 * POST /auth/users/:id/reset-password
 */
export const resetPassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { password } = req.body;

  const result = await authService.resetPassword(id, req.user!.id, password);

  res.json({
    success: true,
    message: 'Password reset successfully',
    data: result,
  });
};

/**
 * PATCH /auth/users/:id/status
 */
export const updateUserStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new AppError(errors.array()[0].msg, 400);
  }

  const { id } = req.params;
  const { status } = req.body;

  await authService.updateUserStatus(id, status, req.user!.id);

  res.json({
    success: true,
    message: 'User status updated successfully',
  });
};

/**
 * DELETE /auth/users/:id
 */
export const deleteUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  await authService.deleteUser(id, req.user!.id);

  res.json({
    success: true,
    message: 'User deleted successfully',
  });
};
