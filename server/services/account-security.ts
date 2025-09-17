import { eq, and, sql } from "drizzle-orm";
import { users } from "@shared/schema";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export interface AccountSecurityConfig {
  maxLoginAttempts: number;
  lockoutDuration: number; // in milliseconds
  passwordHistoryLimit: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireLowercase: boolean;
  passwordRequireNumbers: boolean;
  passwordRequireSymbols: boolean;
}

export const DEFAULT_SECURITY_CONFIG: AccountSecurityConfig = {
  maxLoginAttempts: 5,
  lockoutDuration: 30 * 60 * 1000, // 30 minutes
  passwordHistoryLimit: 5,
  passwordMinLength: 12,
  passwordRequireUppercase: true,
  passwordRequireLowercase: true,
  passwordRequireNumbers: true,
  passwordRequireSymbols: true,
};

export class AccountSecurityService {
  constructor(
    private db: any,
    private config: AccountSecurityConfig = DEFAULT_SECURITY_CONFIG
  ) {}

  /**
   * Check if account is locked due to too many failed login attempts
   */
  async isAccountLocked(userId: number): Promise<{ locked: boolean; remainingTime?: number }> {
    const [user] = await this.db
      .select({
        loginAttempts: users.loginAttempts,
        lockedUntil: users.lockedUntil,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return { locked: false };
    }

    // Check if account is locked
    if (user.lockedUntil && new Date() < user.lockedUntil) {
      const remainingTime = user.lockedUntil.getTime() - Date.now();
      return { locked: true, remainingTime };
    }

    // Reset lock if time has passed
    if (user.lockedUntil && new Date() >= user.lockedUntil) {
      await this.db
        .update(users)
        .set({
          loginAttempts: 0,
          lockedUntil: null
        })
        .where(eq(users.id, userId));
    }

    return { locked: false };
  }

  /**
   * Record a failed login attempt
   */
  async recordFailedLogin(userId: number): Promise<{ shouldLock: boolean; attemptsRemaining: number }> {
    const [user] = await this.db
      .select({
        loginAttempts: users.loginAttempts,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      throw new Error('User not found');
    }

    const newAttempts = (user.loginAttempts || 0) + 1;
    const shouldLock = newAttempts >= this.config.maxLoginAttempts;

    const updateData: any = {
      loginAttempts: newAttempts,
    };

    if (shouldLock) {
      updateData.lockedUntil = new Date(Date.now() + this.config.lockoutDuration);
      console.log(`🔒 Account locked for user ${userId} due to ${newAttempts} failed attempts`);
    }

    await this.db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId));

    const attemptsRemaining = Math.max(0, this.config.maxLoginAttempts - newAttempts);

    return { shouldLock, attemptsRemaining };
  }

  /**
   * Record successful login and reset failed attempts
   */
  async recordSuccessfulLogin(userId: number): Promise<void> {
    await this.db
      .update(users)
      .set({
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
        lastActivityAt: new Date(),
      })
      .where(eq(users.id, userId));

    console.log(`✅ Successful login recorded for user ${userId}`);
  }

  /**
   * Validate password strength
   */
  validatePasswordStrength(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < this.config.passwordMinLength) {
      errors.push(`Password must be at least ${this.config.passwordMinLength} characters long`);
    }

    if (this.config.passwordRequireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.config.passwordRequireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.config.passwordRequireNumbers && !/[0-9]/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (this.config.passwordRequireSymbols && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one symbol (!@#$%^&*(),.?":{}|<>)');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Check if password was used recently (prevent password reuse)
   */
  async isPasswordInHistory(userId: number, newPassword: string): Promise<boolean> {
    const [user] = await this.db
      .select({
        passwordHistory: users.passwordHistory,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user || !user.passwordHistory) {
      return false;
    }

    const history = user.passwordHistory as string[];

    // Check against recent password hashes
    for (const oldHash of history) {
      if (await bcrypt.compare(newPassword, oldHash)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Change user password with security checks
   */
  async changePassword(params: {
    userId: number;
    newPassword: string;
    currentPassword?: string;
    bypassCurrentCheck?: boolean; // For admin resets
  }): Promise<{ success: boolean; errors: string[] }> {
    const { userId, newPassword, currentPassword, bypassCurrentCheck = false } = params;

    // Validate new password strength
    const strengthCheck = this.validatePasswordStrength(newPassword);
    if (!strengthCheck.valid) {
      return { success: false, errors: strengthCheck.errors };
    }

    // Get current user data
    const [user] = await this.db
      .select({
        password: users.password,
        passwordHistory: users.passwordHistory,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return { success: false, errors: ['User not found'] };
    }

    // Verify current password (unless bypassed for admin resets)
    if (!bypassCurrentCheck && currentPassword) {
      const currentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!currentPasswordValid) {
        return { success: false, errors: ['Current password is incorrect'] };
      }
    }

    // Check password history
    const inHistory = await this.isPasswordInHistory(userId, newPassword);
    if (inHistory) {
      return {
        success: false,
        errors: [`Password cannot be one of your last ${this.config.passwordHistoryLimit} passwords`]
      };
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password history
    const history = (user.passwordHistory as string[]) || [];
    history.unshift(user.password); // Add current password to history
    const limitedHistory = history.slice(0, this.config.passwordHistoryLimit - 1);

    // Update user record
    await this.db
      .update(users)
      .set({
        password: hashedPassword,
        passwordHistory: limitedHistory,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
      })
      .where(eq(users.id, userId));

    console.log(`🔐 Password changed for user ${userId}`);

    return { success: true, errors: [] };
  }

  /**
   * Generate secure password reset token
   */
  async generatePasswordResetToken(userId: number): Promise<{ token: string; expiresAt: Date }> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.db
      .update(users)
      .set({
        passwordResetToken: token,
        passwordResetExpires: expiresAt,
      })
      .where(eq(users.id, userId));

    console.log(`🔑 Password reset token generated for user ${userId}`);

    return { token, expiresAt };
  }

  /**
   * Verify password reset token
   */
  async verifyPasswordResetToken(token: string): Promise<{ valid: boolean; userId?: number }> {
    const [user] = await this.db
      .select({
        id: users.id,
        passwordResetToken: users.passwordResetToken,
        passwordResetExpires: users.passwordResetExpires,
      })
      .from(users)
      .where(eq(users.passwordResetToken, token));

    if (!user) {
      return { valid: false };
    }

    // Check if token has expired
    if (!user.passwordResetExpires || new Date() > user.passwordResetExpires) {
      // Clear expired token
      await this.db
        .update(users)
        .set({
          passwordResetToken: null,
          passwordResetExpires: null,
        })
        .where(eq(users.id, user.id));

      return { valid: false };
    }

    return { valid: true, userId: user.id };
  }

  /**
   * Reset password using token
   */
  async resetPasswordWithToken(params: {
    token: string;
    newPassword: string;
  }): Promise<{ success: boolean; errors: string[] }> {
    const { token, newPassword } = params;

    // Verify token
    const tokenVerification = await this.verifyPasswordResetToken(token);
    if (!tokenVerification.valid || !tokenVerification.userId) {
      return { success: false, errors: ['Invalid or expired reset token'] };
    }

    // Change password
    const result = await this.changePassword({
      userId: tokenVerification.userId,
      newPassword,
      bypassCurrentCheck: true, // Reset doesn't require current password
    });

    if (result.success) {
      // Clear reset token
      await this.db
        .update(users)
        .set({
          passwordResetToken: null,
          passwordResetExpires: null,
        })
        .where(eq(users.id, tokenVerification.userId));

      console.log(`🔓 Password reset completed for user ${tokenVerification.userId}`);
    }

    return result;
  }

  /**
   * Force password change on next login
   */
  async requirePasswordChange(userId: number, reason?: string): Promise<void> {
    await this.db
      .update(users)
      .set({
        mustChangePassword: true,
      })
      .where(eq(users.id, userId));

    console.log(`⚠️ Password change required for user ${userId}${reason ? ': ' + reason : ''}`);
  }

  /**
   * Unlock account (admin action)
   */
  async unlockAccount(userId: number, adminId: number): Promise<void> {
    await this.db
      .update(users)
      .set({
        loginAttempts: 0,
        lockedUntil: null,
      })
      .where(eq(users.id, userId));

    console.log(`🔓 Account unlocked for user ${userId} by admin ${adminId}`);
  }

  /**
   * Get account security status
   */
  async getSecurityStatus(userId: number): Promise<{
    loginAttempts: number;
    isLocked: boolean;
    lockExpiresAt?: Date;
    passwordAge?: number; // days since last password change
    mustChangePassword: boolean;
  }> {
    const [user] = await this.db
      .select({
        loginAttempts: users.loginAttempts,
        lockedUntil: users.lockedUntil,
        passwordChangedAt: users.passwordChangedAt,
        mustChangePassword: users.mustChangePassword,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      throw new Error('User not found');
    }

    const isLocked = user.lockedUntil ? new Date() < user.lockedUntil : false;
    const passwordAge = user.passwordChangedAt
      ? Math.floor((Date.now() - user.passwordChangedAt.getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

    return {
      loginAttempts: user.loginAttempts || 0,
      isLocked,
      lockExpiresAt: isLocked ? user.lockedUntil : undefined,
      passwordAge,
      mustChangePassword: user.mustChangePassword || false,
    };
  }
}

// Export singleton instance
export const accountSecurityService = new AccountSecurityService(null);