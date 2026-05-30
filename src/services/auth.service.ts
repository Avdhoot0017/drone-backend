import { prisma } from '../config/database';
import { logger } from '../config/logger';
import {
  hashPassword,
  verifyPassword,
  generateRandomPassword,
  validatePasswordStrength,
} from '../utils/password';
import { generateToken, getTokenExpiration } from '../utils/jwt';
import {
  CreateUserInput,
  LoginInput,
  LoginResponse,
  ChangePasswordInput,
} from '../types';
import { UserRole, UserStatus } from '@prisma/client';
import { AppError } from '../middleware';

class AuthService {
  /**
   * Login user
   */
  async login(input: LoginInput, ipAddress?: string): Promise<LoginResponse> {
    const { userId, password } = input;

    // Find user
    const user = await prisma.user.findUnique({
      where: { userId },
    });

    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check if user is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new AppError('Account is locked. Please try again later.', 423);
    }

    // Check if user is active
    if (user.status !== UserStatus.active) {
      throw new AppError('Account is not active', 403);
    }

    // Verify password
    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      // Increment failed attempts
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: { increment: 1 },
          // Lock after 5 failed attempts for 30 minutes
          lockedUntil:
            user.failedLoginAttempts >= 4
              ? new Date(Date.now() + 30 * 60 * 1000)
              : undefined,
        },
      });

      throw new AppError('Invalid credentials', 401);
    }

    // Reset failed attempts and update last login
    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastLoginIp: ipAddress,
      },
    });

    // Generate token
    const token = generateToken({
      userId: user.userId,
      id: user.id,
      role: user.role,
    });

    // Log activity
    await this.logActivity(user.id, 'LOGIN', undefined, undefined, { ipAddress });

    logger.info(`User logged in: ${user.userId}`);

    return {
      user: {
        id: user.id,
        userId: user.userId,
        fullName: user.fullName,
        role: user.role,
        email: user.email || undefined,
        mustChangePassword: user.mustChangePassword,
      },
      token,
      expiresAt: getTokenExpiration(),
    };
  }

  /**
   * Create a new user (admin only)
   */
  async createUser(
    input: CreateUserInput,
    createdById: string
  ): Promise<{ userId: string; password: string }> {
    // Check if userId already exists
    const existing = await prisma.user.findUnique({
      where: { userId: input.userId },
    });

    if (existing) {
      throw new AppError('User ID already exists', 409);
    }

    // Check if email exists (if provided)
    if (input.email) {
      const emailExists = await prisma.user.findUnique({
        where: { email: input.email },
      });

      if (emailExists) {
        throw new AppError('Email already exists', 409);
      }
    }

    // Generate password if not provided
    const password = input.password || generateRandomPassword();

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.isValid) {
      throw new AppError(passwordValidation.errors.join(', '), 400);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await prisma.user.create({
      data: {
        userId: input.userId,
        passwordHash,
        fullName: input.fullName,
        role: input.role,
        email: input.email,
        phone: input.phone,
        designation: input.designation,
        enforcementAreaId: input.enforcementAreaId,
        canViewAllAreas: input.canViewAllAreas || false,
        mustChangePassword: true,
        createdBy: createdById,
      },
    });

    // Log activity
    await this.logActivity(createdById, 'CREATE_USER', 'user', user.id);

    logger.info(`User created: ${user.userId} by ${createdById}`);

    return {
      userId: user.userId,
      password,
    };
  }

  /**
   * Change password
   */
  async changePassword(
    userId: string,
    input: ChangePasswordInput
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Verify current password
    const isValid = await verifyPassword(input.currentPassword, user.passwordHash);

    if (!isValid) {
      throw new AppError('Current password is incorrect', 401);
    }

    // Validate new password
    const passwordValidation = validatePasswordStrength(input.newPassword);
    if (!passwordValidation.isValid) {
      throw new AppError(passwordValidation.errors.join(', '), 400);
    }

    // Hash new password
    const passwordHash = await hashPassword(input.newPassword);

    // Update password
    await prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
      },
    });

    // Log activity
    await this.logActivity(userId, 'CHANGE_PASSWORD');

    logger.info(`Password changed for user: ${user.userId}`);
  }

  /**
   * Reset password (admin only)
   */
  async resetPassword(
    userId: string,
    adminId: string,
    customPassword?: string
  ): Promise<{ newPassword: string }> {
    const user = await prisma.user.findUnique({
      where: { userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Use custom password or generate random one
    const newPassword = customPassword || generateRandomPassword();

    // Validate password strength if custom password provided
    if (customPassword) {
      const passwordValidation = validatePasswordStrength(customPassword);
      if (!passwordValidation.isValid) {
        throw new AppError(passwordValidation.errors.join(', '), 400);
      }
    }

    const passwordHash = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { userId },
      data: {
        passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: true,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    // Log activity
    await this.logActivity(adminId, 'RESET_PASSWORD', 'user', userId);

    logger.info(`Password reset for user: ${user.userId} by admin: ${adminId}`);

    return { newPassword };
  }

  /**
   * Get current user profile
   */
  async getProfile(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        enforcementArea: true,
      },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    return {
      id: user.id,
      userId: user.userId,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      designation: user.designation,
      role: user.role,
      status: user.status,
      enforcementArea: user.enforcementArea
        ? {
            id: user.enforcementArea.id,
            name: user.enforcementArea.name,
          }
        : null,
      canViewAllAreas: user.canViewAllAreas,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  /**
   * Get all users (admin only)
   */
  async getAllUsers() {
    const users = await prisma.user.findMany({
      include: {
        enforcementArea: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => ({
      id: user.id,
      userId: user.userId,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      status: user.status,
      enforcementArea: user.enforcementArea?.name,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    }));
  }

  /**
   * Update user status (admin only)
   */
  async updateUserStatus(
    userId: string,
    status: UserStatus,
    adminId: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    await prisma.user.update({
      where: { userId },
      data: { status },
    });

    await this.logActivity(adminId, 'UPDATE_USER_STATUS', 'user', userId, {
      newStatus: status,
    });
  }

  /**
   * Delete user (admin only)
   */
  async deleteUser(userId: string, adminId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { userId },
    });

    if (!user) {
      throw new AppError('User not found', 404);
    }

    if (user.role === UserRole.admin) {
      // Check if this is the last admin
      const adminCount = await prisma.user.count({
        where: { role: UserRole.admin },
      });

      if (adminCount <= 1) {
        throw new AppError('Cannot delete the last admin user', 400);
      }
    }

    await prisma.user.delete({
      where: { userId },
    });

    await this.logActivity(adminId, 'DELETE_USER', 'user', userId);
  }

  /**
   * Log user activity
   */
  private async logActivity(
    userId: string,
    action: string,
    entityType?: string,
    entityId?: string,
    details?: Record<string, unknown>
  ) {
    await prisma.userActivityLog.create({
      data: {
        userId,
        action,
        entityType,
        entityId,
        details: details ? (details as object) : undefined,
      },
    });
  }
}

export const authService = new AuthService();
