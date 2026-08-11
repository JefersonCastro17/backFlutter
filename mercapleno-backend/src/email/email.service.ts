import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { LowStockAlert } from '../common/stock/low-stock.util';
import { envs } from '../config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter | null = null;
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly prisma: PrismaService) {}

  private getTransporter(): nodemailer.Transporter {
    if (this.transporter) {
      return this.transporter;
    }

    if (!envs.smtpUser || !envs.smtpPass) {
      throw new Error('SMTP no configurado: faltan SMTP_USER/SMTP_PASS');
    }

    if (!envs.smtpService && !envs.smtpHost) {
      throw new Error('SMTP no configurado: falta SMTP_HOST o SMTP_SERVICE');
    }

    const options = envs.smtpService
      ? {
          service: envs.smtpService,
          auth: {
            user: envs.smtpUser,
            pass: envs.smtpPass,
          },
        }
      : {
          host: envs.smtpHost,
          port: envs.smtpPort,
          secure: envs.smtpSecure,
          auth: {
            user: envs.smtpUser,
            pass: envs.smtpPass,
          },
        };

    this.transporter = nodemailer.createTransport(options);
    return this.transporter;
  }

  private fromAddress(): string {
    const from = envs.smtpFromEmail || envs.smtpUser;
    if (!from) {
      throw new Error('SMTP no configurado: falta SMTP_FROM_EMAIL');
    }

    return envs.appName ? `"${envs.appName}" <${from}>` : from;
  }

  private async sendMailHelper(
    mailOptions: nodemailer.SendMailOptions,
    successLogMessage: string,
  ): Promise<void> {
    try {
      const transporter = this.getTransporter();
      const info = await transporter.sendMail(mailOptions);
      this.logger.log(`${successLogMessage}. Message ID: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`Error al enviar correo: ${(error as Error).message}`, (error as Error).stack);
      
      if (envs.nodeEnv !== 'production') {
        this.logger.warn(
          `[DEVELOPMENT FALLBACK] No se pudo enviar el correo debido a un error SMTP, pero se procedió sin fallar. ` +
          `Destinatario: ${mailOptions.to}, Asunto: ${mailOptions.subject}, Texto: ${mailOptions.text}`
        );
        return;
      }
      throw error;
    }
  }

  async sendVerificationCode(email: string, code: string, ttlMin: number): Promise<void> {
    await this.sendMailHelper(
      {
        from: this.fromAddress(),
        to: email,
        subject: `${envs.appName} - Codigo de verificacion`,
        text: `Tu codigo de verificacion es ${code}. Vence en ${ttlMin} minutos.`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <p>Tu codigo de verificacion es:</p>
            <div style="font-size: 28px; font-weight: bold; letter-spacing: 2px;">${code}</div>
            <p>Este codigo vence en ${ttlMin} minutos.</p>
          </div>
        `,
      },
      `Correo de verificacion enviado a ${email}`,
    );
  }

  async sendLoginTwoFactorCode(
    email: string,
    code: string,
    ttlMin: number,
    roleName?: string,
  ): Promise<void> {
    const profileLabel = roleName?.trim() || 'usuario administrativo';
    await this.sendMailHelper(
      {
        from: this.fromAddress(),
        to: email,
        subject: `${envs.appName} - Codigo de acceso`,
        text: `Tu codigo de segundo factor para ${profileLabel} es ${code}. Vence en ${ttlMin} minutos.`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <p>Recibimos un intento de inicio de sesion para tu cuenta de <strong>${profileLabel}</strong>.</p>
            <p>Tu codigo de segundo factor es:</p>
            <div style="font-size: 28px; font-weight: bold; letter-spacing: 2px;">${code}</div>
            <p>Este codigo vence en ${ttlMin} minutos y solo sirve para completar este inicio de sesion.</p>
          </div>
        `,
      },
      `Correo de segundo factor enviado a ${email}`,
    );
  }

  async sendPasswordResetCode(email: string, code: string, ttlMin: number): Promise<void> {
    await this.sendMailHelper(
      {
        from: this.fromAddress(),
        to: email,
        subject: `${envs.appName} - Recuperar contrasena`,
        text: `Tu codigo para recuperar contrasena es ${code}. Vence en ${ttlMin} minutos.`,
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.5;">
            <p>Tu codigo para recuperar contrasena es:</p>
            <div style="font-size: 28px; font-weight: bold; letter-spacing: 2px;">${code}</div>
            <p>Este codigo vence en ${ttlMin} minutos.</p>
          </div>
        `,
      },
      `Correo de recuperacion enviado a ${email}`,
    );
  }

  async sendLowStockAlertToAdmins(alerts: LowStockAlert[], source: string): Promise<void> {
    if (!alerts.length) {
      return;
    }

    const admins = await this.prisma.usuarios.findMany({
      where: { id_rol: 1 },
      select: { email: true },
    });

    const recipientEmails = Array.from(
      new Set(
        admins
          .map((admin) => admin.email?.trim().toLowerCase())
          .filter((email): email is string => Boolean(email)),
      ),
    );

    if (!recipientEmails.length) {
      this.logger.warn('No hay administradores con correo disponible para alerta de stock bajo');
      return;
    }

    const timestamp = new Date().toLocaleString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const sourceLabel = source.trim() || 'operacion del sistema';
    const summary =
      alerts.length === 1
        ? alerts[0].message
        : `${alerts.length} productos quedaron con stock bajo.`;

    await this.sendMailHelper(
      {
        from: this.fromAddress(),
        to: recipientEmails.join(','),
        subject: `${envs.appName} - Alerta de stock bajo`,
        text: [
          `Se detecto stock bajo tras ${sourceLabel}.`,
          `Fecha: ${timestamp}.`,
          '',
          ...alerts.map((alert, index) => `${index + 1}. ${alert.message}`),
        ].join('\n'),
        html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2 style="margin-bottom: 8px;">Alerta de stock bajo</h2>
            <p style="margin: 0 0 8px;">
              Se detecto stock bajo tras <strong>${sourceLabel}</strong>.
            </p>
            <p style="margin: 0 0 16px; color: #64748b;">${timestamp}</p>
            <p style="margin: 0 0 16px;">${summary}</p>
            <ul style="padding-left: 18px; margin: 0;">
              ${alerts
                .map(
                  (alert) => `
                    <li style="margin-bottom: 10px;">
                      <strong>${alert.productName?.trim() || `Producto ID ${alert.productId}`}</strong><br />
                      ${alert.message}<br />
                      Umbral configurado: ${alert.threshold}
                    </li>
                  `,
                )
                .join('')}
            </ul>
          </div>
        `,
      },
      `Alerta de stock bajo enviada a ${recipientEmails.join(', ')} para ${alerts.length} producto(s)`,
    );
  }
}
