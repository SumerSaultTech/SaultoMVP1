import sgMail from '@sendgrid/mail';

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface PasswordResetEmailData {
  firstName: string;
  resetLink: string;
  expirationTime: string;
}

interface UserCreatedEmailData {
  firstName: string;
  lastName: string;
  email: string;
  username: string;
  role: string;
  companyName?: string;
  tempPassword?: string;
  loginLink: string;
}

interface AdminNotificationEmailData {
  newUserName: string;
  newUserEmail: string;
  newUserRole: string;
  companyName: string;
  createdBy: string;
}

class EmailService {
  private isConfigured: boolean = false;
  private fromEmail: string = 'noreply@saulto.com';
  private fromName: string = 'Saulto Team';

  constructor() {
    this.initialize();
  }

  private initialize() {
    const apiKey = process.env.SENDGRID_API_KEY;

    if (!apiKey) {
      console.warn('⚠️ SendGrid API key not configured. Email functionality will be disabled.');
      console.warn('   Set SENDGRID_API_KEY in your environment variables to enable emails.');
      return;
    }

    sgMail.setApiKey(apiKey);
    this.isConfigured = true;

    // Override from email if configured
    if (process.env.FROM_EMAIL) {
      this.fromEmail = process.env.FROM_EMAIL;
    }
    if (process.env.FROM_NAME) {
      this.fromName = process.env.FROM_NAME;
    }

    console.log('✅ Email service initialized with SendGrid');
    console.log(`📧 From: ${this.fromName} <${this.fromEmail}>`);
  }

  private getPasswordResetTemplate(data: PasswordResetEmailData): EmailTemplate {
    return {
      subject: 'Reset Your Saulto Password',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
            <style>
                body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; padding: 30px 0; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; }
                .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
                .content { padding: 40px 30px; background: #ffffff; }
                .button { display: inline-block; padding: 14px 28px; background: #22c55e; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
                .button:hover { background: #16a34a; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
                .warning { background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0; }
                .link-backup { word-break: break-all; color: #666; font-size: 12px; margin-top: 15px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">Saulto</div>
                    <div>Business Metrics Dashboard</div>
                </div>

                <div class="content">
                    <h2>Hi ${data.firstName},</h2>

                    <p>We received a request to reset the password for your Saulto account. If you made this request, click the button below to reset your password:</p>

                    <div style="text-align: center;">
                        <a href="${data.resetLink}" class="button">Reset My Password</a>
                    </div>

                    <div class="warning">
                        <strong>Important:</strong> This password reset link will expire in ${data.expirationTime}. If you didn't request this password reset, you can safely ignore this email.
                    </div>

                    <p>If the button above doesn't work, copy and paste this link into your browser:</p>
                    <div class="link-backup">${data.resetLink}</div>

                    <p>For security reasons, if you don't reset your password within ${data.expirationTime}, you'll need to request a new reset link.</p>

                    <p>Best regards,<br>The Saulto Team</p>
                </div>

                <div class="footer">
                    <p>This email was sent by Saulto. If you have questions, please contact support.</p>
                    <p>© 2025 Saulto by Sumersault. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
      `,
      text: `
Hi ${data.firstName},

We received a request to reset the password for your Saulto account.

If you made this request, click this link to reset your password:
${data.resetLink}

This link will expire in ${data.expirationTime}.

If you didn't request this password reset, you can safely ignore this email.

Best regards,
The Saulto Team

© 2025 Saulto by Sumersault
      `.trim()
    };
  }

  private getUserCreatedTemplate(data: UserCreatedEmailData): EmailTemplate {
    const hasPassword = !!data.tempPassword;

    return {
      subject: `Welcome to Saulto${data.companyName ? ` - ${data.companyName}` : ''}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to Saulto</title>
            <style>
                body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; padding: 30px 0; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; }
                .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
                .content { padding: 40px 30px; background: #ffffff; }
                .button { display: inline-block; padding: 14px 28px; background: #22c55e; color: white; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
                .credentials-box { background: #f3f4f6; border-radius: 8px; padding: 20px; margin: 20px 0; }
                .credential-row { margin: 10px 0; }
                .credential-label { font-weight: 600; color: #374151; }
                .credential-value { font-family: monospace; background: #e5e7eb; padding: 4px 8px; border-radius: 4px; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
                .security-note { background: #ecfdf5; border-left: 4px solid #22c55e; padding: 15px; margin: 20px 0; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">Saulto</div>
                    <div>Business Metrics Dashboard</div>
                </div>

                <div class="content">
                    <h2>Welcome to Saulto, ${data.firstName}!</h2>

                    <p>Your account has been created successfully. You now have access to Saulto's powerful business metrics dashboard.</p>

                    ${data.companyName ? `<p><strong>Company:</strong> ${data.companyName}</p>` : ''}
                    <p><strong>Role:</strong> ${data.role}</p>

                    <div class="credentials-box">
                        <h3>Your Login Credentials</h3>
                        <div class="credential-row">
                            <span class="credential-label">Username:</span>
                            <span class="credential-value">${data.username}</span>
                        </div>
                        <div class="credential-row">
                            <span class="credential-label">Email:</span>
                            <span class="credential-value">${data.email}</span>
                        </div>
                        ${hasPassword ? `
                        <div class="credential-row">
                            <span class="credential-label">Temporary Password:</span>
                            <span class="credential-value">${data.tempPassword}</span>
                        </div>` : ''}
                    </div>

                    <div style="text-align: center;">
                        <a href="${data.loginLink}" class="button">Login to Saulto</a>
                    </div>

                    ${hasPassword ? `
                    <div class="security-note">
                        <strong>Security Notice:</strong> Please change your temporary password after your first login for security purposes.
                    </div>` : ''}

                    <h3>What you can do with Saulto:</h3>
                    <ul>
                        <li>📊 Track key business metrics and KPIs</li>
                        <li>📈 Visualize data with interactive charts</li>
                        <li>🤖 Get AI-powered business insights</li>
                        <li>🔄 Connect your business tools and data sources</li>
                        <li>👥 Collaborate with your team</li>
                    </ul>

                    <p>If you have any questions or need help getting started, don't hesitate to reach out to our support team.</p>

                    <p>Best regards,<br>The Saulto Team</p>
                </div>

                <div class="footer">
                    <p>This email was sent by Saulto. If you have questions, please contact support.</p>
                    <p>© 2025 Saulto by Sumersault. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
      `,
      text: `
Welcome to Saulto, ${data.firstName}!

Your account has been created successfully. You now have access to Saulto's powerful business metrics dashboard.

${data.companyName ? `Company: ${data.companyName}` : ''}
Role: ${data.role}

Your Login Credentials:
Username: ${data.username}
Email: ${data.email}
${hasPassword ? `Temporary Password: ${data.tempPassword}` : ''}

Login here: ${data.loginLink}

${hasPassword ? 'SECURITY NOTICE: Please change your temporary password after your first login.' : ''}

What you can do with Saulto:
- Track key business metrics and KPIs
- Visualize data with interactive charts
- Get AI-powered business insights
- Connect your business tools and data sources
- Collaborate with your team

Best regards,
The Saulto Team

© 2025 Saulto by Sumersault
      `.trim()
    };
  }

  private getAdminNotificationTemplate(data: AdminNotificationEmailData): EmailTemplate {
    return {
      subject: `New User Created: ${data.newUserName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New User Created</title>
            <style>
                body { font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; padding: 30px 0; background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; }
                .logo { font-size: 28px; font-weight: bold; margin-bottom: 10px; }
                .content { padding: 40px 30px; background: #ffffff; }
                .info-box { background: #f8fafc; border-radius: 8px; padding: 20px; margin: 20px 0; border-left: 4px solid #22c55e; }
                .info-row { margin: 8px 0; }
                .info-label { font-weight: 600; color: #374151; display: inline-block; width: 100px; }
                .footer { text-align: center; padding: 20px; color: #666; font-size: 14px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="logo">Saulto</div>
                    <div>Admin Notification</div>
                </div>

                <div class="content">
                    <h2>New User Created</h2>

                    <p>A new user has been added to the Saulto platform.</p>

                    <div class="info-box">
                        <h3>User Details</h3>
                        <div class="info-row">
                            <span class="info-label">Name:</span>
                            ${data.newUserName}
                        </div>
                        <div class="info-row">
                            <span class="info-label">Email:</span>
                            ${data.newUserEmail}
                        </div>
                        <div class="info-row">
                            <span class="info-label">Role:</span>
                            ${data.newUserRole}
                        </div>
                        <div class="info-row">
                            <span class="info-label">Company:</span>
                            ${data.companyName}
                        </div>
                        <div class="info-row">
                            <span class="info-label">Created by:</span>
                            ${data.createdBy}
                        </div>
                        <div class="info-row">
                            <span class="info-label">Date:</span>
                            ${new Date().toLocaleString()}
                        </div>
                    </div>

                    <p>The new user has been sent welcome instructions via email.</p>

                    <p>Best regards,<br>Saulto System</p>
                </div>

                <div class="footer">
                    <p>This is an automated notification from Saulto.</p>
                    <p>© 2025 Saulto by Sumersault. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
      `,
      text: `
New User Created - Saulto

A new user has been added to the Saulto platform.

User Details:
Name: ${data.newUserName}
Email: ${data.newUserEmail}
Role: ${data.newUserRole}
Company: ${data.companyName}
Created by: ${data.createdBy}
Date: ${new Date().toLocaleString()}

The new user has been sent welcome instructions via email.

This is an automated notification from Saulto.
© 2025 Saulto by Sumersault
      `.trim()
    };
  }

  async sendEmail(to: string, template: EmailTemplate): Promise<boolean> {
    if (!this.isConfigured) {
      console.log(`📧 Email sending disabled (no API key). Would send to ${to}:`);
      console.log(`   Subject: ${template.subject}`);
      console.log(`   Content: ${template.text.substring(0, 100)}...`);
      return false;
    }

    try {
      const msg = {
        to,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject: template.subject,
        text: template.text,
        html: template.html,
      };

      await sgMail.send(msg);
      console.log(`✅ Email sent successfully to ${to}: ${template.subject}`);
      return true;
    } catch (error) {
      console.error(`❌ Failed to send email to ${to}:`, error);
      return false;
    }
  }

  async sendPasswordResetEmail(to: string, data: PasswordResetEmailData): Promise<boolean> {
    const template = this.getPasswordResetTemplate(data);
    return this.sendEmail(to, template);
  }

  async sendUserCreatedEmail(to: string, data: UserCreatedEmailData): Promise<boolean> {
    const template = this.getUserCreatedTemplate(data);
    return this.sendEmail(to, template);
  }

  async sendAdminNotificationEmail(to: string, data: AdminNotificationEmailData): Promise<boolean> {
    const template = this.getAdminNotificationTemplate(data);
    return this.sendEmail(to, template);
  }

  // Utility method to send to multiple admins
  async sendAdminNotifications(adminEmails: string[], data: AdminNotificationEmailData): Promise<void> {
    const promises = adminEmails.map(email =>
      this.sendAdminNotificationEmail(email, data)
    );

    await Promise.all(promises);
    console.log(`📧 Admin notifications sent to ${adminEmails.length} recipients`);
  }

  isEnabled(): boolean {
    return this.isConfigured;
  }
}

export const emailService = new EmailService();