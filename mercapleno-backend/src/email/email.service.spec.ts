import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';
import { envs } from '../config';

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockImplementation((options: any) => {
    mockCreateTransport(options);
    return {
      sendMail: (...args: any[]) => mockSendMail(...args),
    };
  }),
}));

describe('EmailService', () => {
  let service: EmailService;
  let prisma: PrismaService;

  const mockPrismaService = {
    usuarios: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    mockSendMail.mockReset();
    mockSendMail.mockResolvedValue({ messageId: 'test-message-id' });
    mockCreateTransport.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendVerificationCode', () => {
    it('should call sendMail with correct verification parameters', async () => {
      await service.sendVerificationCode('user@example.com', '123456', 15);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'user@example.com',
          subject: expect.stringContaining('Codigo de verificacion'),
          text: expect.stringContaining('123456'),
          html: expect.stringContaining('123456'),
        })
      );
    });
  });

  describe('sendLoginTwoFactorCode', () => {
    it('should call sendMail with correct 2FA parameters', async () => {
      await service.sendLoginTwoFactorCode('admin@example.com', '654321', 10, 'administrador');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@example.com',
          subject: expect.stringContaining('Codigo de acceso'),
          text: expect.stringContaining('654321'),
          html: expect.stringContaining('administrador'),
        })
      );
    });
  });

  describe('sendPasswordResetCode', () => {
    it('should call sendMail with correct reset parameters', async () => {
      await service.sendPasswordResetCode('reset@example.com', 'RESET123', 15);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'reset@example.com',
          subject: expect.stringContaining('Recuperar contrasena'),
          text: expect.stringContaining('RESET123'),
        })
      );
    });
  });

  describe('SMTP credential normalization', () => {
    it('should pass normalized SMTP credentials to the transport', async () => {
      (envs as typeof envs & { smtpUser?: string; smtpPass?: string }).smtpUser = 'user@example.com';
      (envs as typeof envs & { smtpPass?: string }).smtpPass = 'abcdefghijkl';

      await service.sendVerificationCode('normalize@example.com', '123456', 5);

      expect(mockCreateTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: { user: 'user@example.com', pass: 'abcdefghijkl' },
        }),
      );
    });
  });

  describe('sendLowStockAlertToAdmins', () => {
    it('should do nothing if alerts array is empty', async () => {
      await service.sendLowStockAlertToAdmins([], 'test');

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('should fetch admins and send email with stock alert messages', async () => {
      const mockAdmins = [
        { email: 'admin1@test.com' },
        { email: 'admin2@test.com' },
      ];
      mockPrismaService.usuarios.findMany.mockResolvedValue(mockAdmins);

      const alerts = [
        { productId: 1, productName: 'Product A', remainingStock: 2, threshold: 5, message: 'Stock is 2 for Product A' },
      ];

      await service.sendLowStockAlertToAdmins(alerts, 'test-movement');

      expect(mockPrismaService.usuarios.findMany).toHaveBeenCalledWith({
        where: { id_rol: 1 },
        select: { email: true },
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin1@test.com,admin2@test.com',
          subject: expect.stringContaining('Alerta de stock bajo'),
          text: expect.stringContaining('Product A'),
          html: expect.stringContaining('Product A'),
        })
      );
    });
  });

  describe('SMTP connection error handling', () => {
    it('should catch SMTP error and not throw in non-production environments', async () => {
      mockSendMail.mockRejectedValue(new Error('SMTP connection timed out'));

      // This should complete without throwing error because envs.nodeEnv is 'test' (non-production fallback)
      await expect(
        service.sendVerificationCode('fallback@example.com', '999999', 5)
      ).resolves.not.toThrow();
    });
  });
});
