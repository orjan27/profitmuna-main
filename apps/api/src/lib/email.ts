import { Resend } from 'resend';

export type EmailService = {
  sendVerificationEmail(to: string, verifyUrl: string): Promise<void>;
  sendWelcomeEmail(to: string, name: string): Promise<void>;
  sendPasswordResetEmail(to: string, resetUrl: string): Promise<void>;
  /** Phase 6: D-04 — simple income-reminder nudge with a link to the income page. */
  sendIncomeReminderEmail(to: string, name: string, incomePageUrl: string): Promise<void>;
};

/**
 * Builds the Resend-backed email service.
 * @param apiKey - RESEND_API_KEY from c.env (never module scope)
 * @param fromEmail - Verified sender address (RESEND_FROM_EMAIL)
 * @returns Email service with verification, welcome, and reset senders
 */
export function createEmailService(apiKey: string, fromEmail: string): EmailService {
  const resend = new Resend(apiKey);
  const from = `Profitmuna <${fromEmail}>`;

  return {
    async sendVerificationEmail(to: string, verifyUrl: string): Promise<void> {
      const { error } = await resend.emails.send({
        from,
        to,
        subject: 'Verify your Profitmuna email',
        html: `<p>Welcome to Profitmuna! Click <a href="${verifyUrl}">here</a> to verify your email address. This link expires in 24 hours.</p>`,
      });
      // Log without the email body (security.md: no PII bodies in logs)
      if (error) console.error('sendVerificationEmail failed:', { to, error });
    },

    async sendWelcomeEmail(to: string, name: string): Promise<void> {
      const { error } = await resend.emails.send({
        from,
        to,
        subject: 'Welcome to Profitmuna',
        html: `<p>Hi ${name}, welcome to Profitmuna — your income allocations are about to get a lot simpler.</p>`,
      });
      if (error) console.error('sendWelcomeEmail failed:', { to, error });
    },

    async sendPasswordResetEmail(to: string, resetUrl: string): Promise<void> {
      const { error } = await resend.emails.send({
        from,
        to,
        subject: 'Reset your Profitmuna password',
        html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
      });
      if (error) console.error('sendPasswordResetEmail failed:', { to, error });
    },

    /**
     * Sends a simple income-logging nudge to the user (D-04).
     * Short plain-HTML message with the user's name + link to the income page.
     * No aggregate stats — just a reminder to record income (locked by CONTEXT.md D-04).
     *
     * @param to           Recipient email address
     * @param name         User's display name
     * @param incomePageUrl  Full URL to the income page (from env.APP_BASE_URL + /income)
     */
    async sendIncomeReminderEmail(to: string, name: string, incomePageUrl: string): Promise<void> {
      const { error } = await resend.emails.send({
        from,
        to,
        subject: 'Profitmuna: Time to log your income',
        html: `<p>Hi ${name}, don&apos;t forget to log any income you received. <a href="${incomePageUrl}">Go to income page</a></p>`,
      });
      // Log without PII body (security.md: no PII bodies in logs)
      if (error) console.error('sendIncomeReminderEmail failed:', { to, error });
    },
  };
}
