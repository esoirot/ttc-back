import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(private readonly config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    this.from = config.get<string>('SMTP_FROM') ?? 'noreply@ttc.local';

    if (host) {
      const port = config.get<number>('SMTP_PORT') ?? 587;
      this.transporter = createTransport({
        host,
        port,
        secure: port === 465,
        auth: {
          user: config.get<string>('SMTP_USER'),
          pass: config.get<string>('SMTP_PASS'),
        },
      });
    } else {
      this.transporter = null;
    }
  }

  async sendPasswordReset(to: string, token: string): Promise<void> {
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:5173';
    const url = `${frontendUrl}/reset-password?token=${token}`;

    if (!this.transporter) {
      Logger.log(`[DEV] Password reset URL for ${to}: ${url}`, 'EmailService');
      return;
    }

    await this.transporter.sendMail({
      from: this.from,
      to,
      subject: 'Reset your TTC password',
      text: `Reset your password: ${url}\n\nThis link expires in 1 hour.`,
      html: `<p>Reset your password: <a href="${url}">${url}</a></p><p>This link expires in 1 hour.</p>`,
    });
  }
}
