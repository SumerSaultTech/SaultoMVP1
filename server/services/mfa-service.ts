import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

export class MFAService {
  constructor(private db: any) {}

  /**
   * Generate MFA secret for a user
   */
  async generateSecret(userId: number, userEmail: string): Promise<{ secret: string; qrCode: string }> {
    try {
      const secret = speakeasy.generateSecret({
        name: userEmail,
        issuer: 'Saulto Admin Dashboard',
        length: 32,
      });

      // Store the secret in the database
      await this.db.update(users)
        .set({ mfaSecret: secret.base32 })
        .where(eq(users.id, userId));

      // Generate QR code
      const qrCode = await QRCode.toDataURL(secret.otpauth_url!);

      return {
        secret: secret.base32,
        qrCode,
      };
    } catch (error) {
      console.error('❌ Failed to generate MFA secret:', error);
      throw new Error('Failed to generate MFA secret');
    }
  }

  /**
   * Verify MFA token
   */
  async verifyToken(userId: number, token: string): Promise<boolean> {
    try {
      const [user] = await this.db.select().from(users).where(eq(users.id, userId));
      
      if (!user || !user.mfaSecret) {
        return false;
      }

      const verified = speakeasy.totp.verify({
        secret: user.mfaSecret,
        encoding: 'base32',
        token,
        window: 2, // Allow 2 time steps before/after current time
      });

      return verified;
    } catch (error) {
      console.error('❌ Failed to verify MFA token:', error);
      return false;
    }
  }

  /**
   * Enable MFA for a user
   */
  async enableMFA(userId: number, token: string): Promise<boolean> {
    try {
      // First verify the token
      const isValid = await this.verifyToken(userId, token);
      
      if (!isValid) {
        return false;
      }

      // Enable MFA for the user
      await this.db.update(users)
        .set({ mfaEnabled: true })
        .where(eq(users.id, userId));

      console.log(`✅ MFA enabled for user ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to enable MFA:', error);
      return false;
    }
  }

  /**
   * Disable MFA for a user
   */
  async disableMFA(userId: number): Promise<boolean> {
    try {
      await this.db.update(users)
        .set({ 
          mfaEnabled: false,
          mfaSecret: null,
        })
        .where(eq(users.id, userId));

      console.log(`✅ MFA disabled for user ${userId}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to disable MFA:', error);
      return false;
    }
  }

  /**
   * Check if user has MFA enabled
   */
  async isMFAEnabled(userId: number): Promise<boolean> {
    try {
      const [user] = await this.db.select().from(users).where(eq(users.id, userId));
      return user?.mfaEnabled || false;
    } catch (error) {
      console.error('❌ Failed to check MFA status:', error);
      return false;
    }
  }

  /**
   * Middleware to require MFA verification
   */
  requireMFA() {
    return async (req: any, res: any, next: any) => {
      try {
        const userId = req.session?.user?.id;
        
        if (!userId) {
          return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const mfaEnabled = await this.isMFAEnabled(userId);
        const mfaVerified = req.session?.mfaVerified;

        if (mfaEnabled && !mfaVerified) {
          return res.status(403).json({ 
            success: false, 
            error: 'MFA verification required',
            requiresMFA: true 
          });
        }

        next();
      } catch (error) {
        console.error('❌ MFA middleware error:', error);
        res.status(500).json({ success: false, error: 'MFA check failed' });
      }
    };
  }
}

// We'll initialize this with the database instance later
export const mfaService = new MFAService(null);