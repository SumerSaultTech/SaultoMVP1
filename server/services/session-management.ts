import { eq, and, lt, sql } from "drizzle-orm";
import { users, userSessions, type UserSession } from "@shared/schema";
import type { Request, Response, NextFunction } from "express";
import crypto from "crypto";

export interface SessionConfig {
  maxAge: number; // Session timeout in milliseconds
  rolling: boolean; // Whether to reset timer on activity
  maxConcurrentSessions: number; // Max sessions per user
  inactivityTimeout: number; // Auto-logout after inactivity (ms)
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  maxAge: 8 * 60 * 60 * 1000, // 8 hours
  rolling: true,
  maxConcurrentSessions: 3,
  inactivityTimeout: 30 * 60 * 1000, // 30 minutes
};

export class SessionManagementService {
  constructor(private db: any, private config: SessionConfig = DEFAULT_SESSION_CONFIG) {}

  /**
   * Create a new session for a user
   */
  async createSession(params: {
    userId: number;
    sessionId: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<UserSession> {
    const { userId, sessionId, ipAddress, userAgent } = params;

    // Check if session already exists (might happen with session reuse)
    const existingSession = await this.db
      .select()
      .from(userSessions)
      .where(eq(userSessions.sessionId, sessionId))
      .limit(1);

    if (existingSession.length > 0) {
      // Update existing session instead of creating new one
      const expiresAt = new Date(Date.now() + this.config.maxAge);
      const [updatedSession] = await this.db
        .update(userSessions)
        .set({
          userId,
          ipAddress,
          userAgent,
          expiresAt,
          lastActivity: new Date()
        })
        .where(eq(userSessions.sessionId, sessionId))
        .returning();

      console.log(`🔄 Session updated for user ${userId}: ${sessionId}`);
      return updatedSession;
    }

    // Check if user has too many active sessions
    await this.enforceSessionLimit(userId);

    const expiresAt = new Date(Date.now() + this.config.maxAge);

    const [session] = await this.db.insert(userSessions).values({
      userId,
      sessionId,
      ipAddress,
      userAgent,
      expiresAt,
    }).returning();

    // Update user's session count
    await this.updateUserSessionCount(userId);

    console.log(`✅ Session created for user ${userId}: ${sessionId}`);
    return session;
  }

  /**
   * Update session activity (for rolling sessions)
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    if (!this.config.rolling) return;

    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.config.maxAge);

    await this.db
      .update(userSessions)
      .set({
        lastActivity: now,
        expiresAt: expiresAt
      })
      .where(eq(userSessions.sessionId, sessionId));
  }

  /**
   * Validate if a session is still active and valid
   */
  async validateSession(sessionId: string): Promise<{ valid: boolean; userId?: number; reason?: string }> {
    const [session] = await this.db
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.sessionId, sessionId),
          eq(userSessions.isActive, true)
        )
      );

    if (!session) {
      return { valid: false, reason: 'Session not found' };
    }

    // Check if session has expired
    if (session.expiresAt && new Date() > session.expiresAt) {
      await this.destroySession(sessionId);
      return { valid: false, reason: 'Session expired' };
    }

    // Check for inactivity timeout
    if (session.lastActivity) {
      const inactiveTime = Date.now() - session.lastActivity.getTime();
      if (inactiveTime > this.config.inactivityTimeout) {
        await this.destroySession(sessionId);
        return { valid: false, reason: 'Session inactive too long' };
      }
    }

    return { valid: true, userId: session.userId };
  }

  /**
   * Destroy a specific session
   */
  async destroySession(sessionId: string): Promise<void> {
    const [session] = await this.db
      .update(userSessions)
      .set({ isActive: false })
      .where(eq(userSessions.sessionId, sessionId))
      .returning();

    if (session) {
      await this.updateUserSessionCount(session.userId);
      console.log(`🗑️ Session destroyed: ${sessionId}`);
    }
  }

  /**
   * Destroy all sessions for a user (useful for password change, etc.)
   */
  async destroyAllUserSessions(userId: number, exceptSessionId?: string): Promise<number> {
    let query = this.db
      .update(userSessions)
      .set({ isActive: false })
      .where(
        and(
          eq(userSessions.userId, userId),
          eq(userSessions.isActive, true)
        )
      );

    // Optionally keep current session active
    if (exceptSessionId) {
      query = query.where(sql`${userSessions.sessionId} != ${exceptSessionId}`);
    }

    const result = await query.returning();
    await this.updateUserSessionCount(userId);

    console.log(`🗑️ Destroyed ${result.length} sessions for user ${userId}`);
    return result.length;
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId: number): Promise<UserSession[]> {
    return await this.db
      .select()
      .from(userSessions)
      .where(
        and(
          eq(userSessions.userId, userId),
          eq(userSessions.isActive, true)
        )
      )
      .orderBy(sql`${userSessions.lastActivity} DESC`);
  }

  /**
   * Clean up expired sessions (run periodically)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.db
      .update(userSessions)
      .set({ isActive: false })
      .where(
        and(
          eq(userSessions.isActive, true),
          lt(userSessions.expiresAt, new Date())
        )
      )
      .returning();

    // Update session counts for affected users
    const userIds = [...new Set(result.map(s => s.userId))];
    for (const userId of userIds) {
      await this.updateUserSessionCount(userId);
    }

    if (result.length > 0) {
      console.log(`🧹 Cleaned up ${result.length} expired sessions`);
    }

    return result.length;
  }

  /**
   * Enforce session limit per user
   */
  private async enforceSessionLimit(userId: number): Promise<void> {
    const activeSessions = await this.getUserSessions(userId);

    if (activeSessions.length >= this.config.maxConcurrentSessions) {
      // Remove oldest sessions to make room
      const sessionsToRemove = activeSessions
        .sort((a, b) => a.lastActivity!.getTime() - b.lastActivity!.getTime())
        .slice(0, activeSessions.length - this.config.maxConcurrentSessions + 1);

      for (const session of sessionsToRemove) {
        await this.destroySession(session.sessionId);
      }

      console.log(`⚠️ Enforced session limit for user ${userId}: removed ${sessionsToRemove.length} old sessions`);
    }
  }

  /**
   * Update user's session count in users table
   */
  private async updateUserSessionCount(userId: number): Promise<void> {
    const activeSessions = await this.db
      .select({ count: sql`count(*)` })
      .from(userSessions)
      .where(
        and(
          eq(userSessions.userId, userId),
          eq(userSessions.isActive, true)
        )
      );

    const count = parseInt(activeSessions[0]?.count || '0');

    await this.db
      .update(users)
      .set({
        sessionCount: count,
        lastActivityAt: new Date()
      })
      .where(eq(users.id, userId));
  }

  /**
   * Get session statistics (for admin dashboard)
   */
  async getSessionStats(): Promise<{
    totalActiveSessions: number;
    uniqueActiveUsers: number;
    averageSessionsPerUser: number;
    expiredSessionsLastHour: number;
  }> {
    const [totalSessions] = await this.db
      .select({ count: sql`count(*)` })
      .from(userSessions)
      .where(eq(userSessions.isActive, true));

    const [uniqueUsers] = await this.db
      .select({ count: sql`count(distinct ${userSessions.userId})` })
      .from(userSessions)
      .where(eq(userSessions.isActive, true));

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const [expiredSessions] = await this.db
      .select({ count: sql`count(*)` })
      .from(userSessions)
      .where(
        and(
          eq(userSessions.isActive, false),
          sql`${userSessions.lastActivity} > ${oneHourAgo}`
        )
      );

    const totalCount = parseInt(totalSessions.count || '0');
    const uniqueCount = parseInt(uniqueUsers.count || '0');

    return {
      totalActiveSessions: totalCount,
      uniqueActiveUsers: uniqueCount,
      averageSessionsPerUser: uniqueCount > 0 ? Math.round((totalCount / uniqueCount) * 100) / 100 : 0,
      expiredSessionsLastHour: parseInt(expiredSessions.count || '0'),
    };
  }
}

/**
 * Middleware to enforce session management
 */
export function createSessionMiddleware(sessionService: SessionManagementService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const sessionId = req.sessionID;

    if (!sessionId || !req.session?.user) {
      return next();
    }

    try {
      // Validate session
      const validation = await sessionService.validateSession(sessionId);

      if (!validation.valid) {
        console.log(`🚫 Invalid session ${sessionId}: ${validation.reason}`);

        // Destroy the session
        req.session?.destroy((err) => {
          if (err) console.error('Failed to destroy invalid session:', err);
        });

        return res.status(401).json({
          success: false,
          error: 'Session invalid',
          reason: validation.reason,
          requiresAuth: true
        });
      }

      // Update session activity
      await sessionService.updateSessionActivity(sessionId);

      next();
    } catch (error) {
      console.error('Session middleware error:', error);
      next(); // Continue even if session check fails
    }
  };
}

// Export singleton instance
export const sessionManagementService = new SessionManagementService(null);