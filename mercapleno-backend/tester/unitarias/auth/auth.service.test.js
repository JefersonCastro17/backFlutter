"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const auth_service_1 = require("../../../src/auth/auth.service");
const prisma_service_1 = require("../../../src/prisma/prisma.service");
const jwt_1 = require("@nestjs/jwt");
const email_service_1 = require("../../../src/email/email.service");
const common_1 = require("@nestjs/common");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const login_dto_1 = require("../../../src/auth/dto/login.dto");
const register_dto_1 = require("../../../src/auth/dto/register.dto");
const request_password_reset_dto_1 = require("../../../src/auth/dto/request-password-reset.dto");
const reset_password_dto_1 = require("../../../src/auth/dto/reset-password.dto");
const verify_login_code_dto_1 = require("../../../src/auth/dto/verify-login-code.dto");
describe('AuthService (Unitarias)', () => {
    let authService;
    let prismaService;
    let emailService;
    let jwtService;
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            providers: [
                auth_service_1.AuthService,
                {
                    provide: prisma_service_1.PrismaService,
                    useValue: {
                        usuarios: {
                            create: jest.fn(),
                            findFirst: jest.fn(),
                            update: jest.fn(),
                        },
                        intentos_login: {
                            findUnique: jest.fn(),
                            create: jest.fn(),
                            update: jest.fn(),
                            delete: jest.fn(),
                        },
                    },
                },
                {
                    provide: jwt_1.JwtService,
                    useValue: {
                        sign: jest.fn().mockReturnValue('mocked_jwt_token'),
                        verifyAsync: jest.fn(),
                        verify: jest.fn(),
                    },
                },
                {
                    provide: email_service_1.EmailService,
                    useValue: {
                        sendVerificationCode: jest.fn(),
                        sendLoginTwoFactorCode: jest.fn(),
                        sendPasswordResetCode: jest.fn(),
                    },
                },
            ],
        }).compile();
        authService = module.get(auth_service_1.AuthService);
        prismaService = module.get(prisma_service_1.PrismaService);
        emailService = module.get(email_service_1.EmailService);
        jwtService = module.get(jwt_1.JwtService);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('RF-001.1 Registrar usuario', () => {
        const registerDto = {
            nombre: 'Test',
            apellido: 'User',
            email: 'test@example.com',
            password: 'Password123!',
            direccion: 'Test St',
            fecha_nacimiento: '2000-01-01',
            id_tipo_identificacion: 1,
            numero_identificacion: '1234567890',
        };
        it('CP-001 - debe verificar que un usuario pueda registrarse correctamente.', async () => {
            jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_password');
            jest.spyOn(prismaService.usuarios, 'create').mockResolvedValue({ id: 1 });
            jest.spyOn(emailService, 'sendVerificationCode').mockResolvedValue(undefined);
            const result = await authService.register(registerDto);
            expect(prismaService.usuarios.create).toHaveBeenCalled();
            expect(emailService.sendVerificationCode).toHaveBeenCalled();
            expect(result).toEqual({
                success: true,
                emailSent: true,
                requiresVerification: true,
                message: 'Usuario registrado. Enviamos un codigo de verificacion a tu correo.',
            });
        });
        it('CP-002 - debe verificar que el sistema no permita registrar un correo electrónico duplicado.', async () => {
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({
                id: 1,
                email: registerDto.email,
            });
            await expect(authService.register(registerDto)).rejects.toThrow(common_1.ConflictException);
            expect(prismaService.usuarios.create).not.toHaveBeenCalled();
        });
        it('CP-003 - debe verificar que el sistema no permita registrar un número de identificación duplicado.', async () => {
            jest.spyOn(prismaService.usuarios, 'findFirst')
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({ id: 1 });
            await expect(authService.register(registerDto)).rejects.toThrow(common_1.ConflictException);
            expect(prismaService.usuarios.findFirst).toHaveBeenNthCalledWith(1, {
                where: { email: registerDto.email },
                select: { id: true },
            });
            expect(prismaService.usuarios.findFirst).toHaveBeenNthCalledWith(2, {
                where: { numero_identificacion: registerDto.numero_identificacion },
                select: { id: true },
            });
        });
        it('CP-004 - debe verificar la validación de campos obligatorios.', async () => {
            const dto = (0, class_transformer_1.plainToInstance)(register_dto_1.RegisterDto, {});
            const errors = await (0, class_validator_1.validate)(dto);
            expect(errors.length).toBeGreaterThan(0);
            const errorProperties = errors.map(e => e.property);
            expect(errorProperties).toContain('nombre');
            expect(errorProperties).toContain('email');
            expect(errorProperties).toContain('password');
            expect(errorProperties).toContain('numero_identificacion');
        });
        it('CP-005 - debe verificar la validación del formato de los datos.', async () => {
            const dto = (0, class_transformer_1.plainToInstance)(register_dto_1.RegisterDto, {
                nombre: '123',
                apellido: '456',
                email: 'correo_invalido',
                password: 'debil',
                direccion: 'Test',
                fecha_nacimiento: 'fecha_invalida',
                id_tipo_identificacion: 'no_entero',
                numero_identificacion: 'ABC',
            });
            const errors = await (0, class_validator_1.validate)(dto);
            expect(errors.length).toBeGreaterThan(0);
            const emailError = errors.find(e => e.property === 'email');
            expect(emailError.constraints).toHaveProperty('isEmail');
            const passwordError = errors.find(e => e.property === 'password');
            expect(passwordError.constraints).toHaveProperty('minLength');
            const identificacionError = errors.find(e => e.property === 'numero_identificacion');
            expect(identificacionError.constraints).toHaveProperty('matches');
        });
        it('CP-006 - debe generar el código de verificación de correo al registrar', async () => {
            jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_password');
            const createSpy = jest.spyOn(prismaService.usuarios, 'create').mockResolvedValue({ id: 1 });
            jest.spyOn(emailService, 'sendVerificationCode').mockResolvedValue(undefined);
            await authService.register(registerDto);
            expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    email_verification_code: expect.any(String),
                    email_verification_expires: expect.any(Date),
                }),
            }));
        });
        it('CP-007 - debe verificar el almacenamiento seguro de la contraseña.', async () => {
            const hashSpy = jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_password');
            const createSpy = jest.spyOn(prismaService.usuarios, 'create').mockResolvedValue({ id: 1 });
            jest.spyOn(emailService, 'sendVerificationCode').mockResolvedValue(undefined);
            await authService.register(registerDto);
            expect(hashSpy).toHaveBeenCalledWith(registerDto.password, 10);
            expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    password: 'hashed_password',
                }),
            }));
        });
        it('CP-008 - debe verificar el comportamiento cuando falla el envío del correo electrónico.', async () => {
            jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_password');
            jest.spyOn(prismaService.usuarios, 'create').mockResolvedValue({ id: 1 });
            jest.spyOn(emailService, 'sendVerificationCode').mockRejectedValue(new Error('Email failed'));
            const result = await authService.register(registerDto);
            expect(result).toEqual({
                success: true,
                emailSent: false,
                requiresVerification: true,
                message: 'Usuario registrado, pero no se pudo enviar el correo. Usa reenviar codigo.',
            });
        });
    });
    describe('RF-001.2: Verificar Correo Electrónico', () => {
        it('CP-009 - debe verificar correctamente el correo electrónico con código válido', async () => {
            const verificationCode = '123456';
            const verificationHash = crypto.createHash('sha256').update(verificationCode).digest('hex');
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({
                id: 1,
                email_verified: false,
                email_verification_code: verificationHash,
                email_verification_expires: new Date(Date.now() + 10000),
            });
            const updateSpy = jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({});
            const result = await authService.verifyEmail({ email: 'test@test.com', code: verificationCode });
            expect(result).toEqual({
                success: true,
                message: 'Correo verificado correctamente.',
            });
            expect(updateSpy).toHaveBeenCalledWith({
                where: { id: 1 },
                data: {
                    email_verified: true,
                    email_verification_code: null,
                    email_verification_expires: null,
                },
            });
        });
        it('CP-010 - debe impedir la verificación cuando el código es incorrecto', async () => {
            const verificationHash = crypto.createHash('sha256').update('000000').digest('hex');
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({
                id: 1,
                email_verified: false,
                email_verification_code: verificationHash,
                email_verification_expires: new Date(Date.now() + 10000),
            });
            const updateSpy = jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({});
            await expect(authService.verifyEmail({ email: 'test@test.com', code: '123456' })).rejects.toThrow(common_1.ForbiddenException);
            expect(updateSpy).not.toHaveBeenCalled();
        });
        it('CP-011 - debe impedir la verificación cuando el código está expirado', async () => {
            const verificationCode = '123456';
            const verificationHash = crypto.createHash('sha256').update(verificationCode).digest('hex');
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({
                id: 1,
                email_verified: false,
                email_verification_code: verificationHash,
                email_verification_expires: new Date(Date.now() - 10000),
            });
            const updateSpy = jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({});
            await expect(authService.verifyEmail({ email: 'test@test.com', code: verificationCode })).rejects.toThrow(common_1.BadRequestException);
            expect(updateSpy).not.toHaveBeenCalled();
        });
        it('CP-012 - debe retornar éxito si el correo ya está verificado', async () => {
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({
                id: 1,
                email_verified: true,
            });
            const result = await authService.verifyEmail({ email: 'test@test.com', code: '123456' });
            expect(result).toEqual({
                success: true,
                message: 'El correo ya esta verificado.',
            });
        });
        it('CP-013 - debe arrojar Error si hay un error en BD al verificar', async () => {
            jest.spyOn(prismaService.usuarios, 'findFirst').mockRejectedValue(new Error('DB Error'));
            await expect(authService.verifyEmail({ email: 'test@test.com', code: '123456' })).rejects.toThrow(Error);
        });
    });
    describe('RF-001.3: Reenviar Código de Verificación', () => {
        it('CP-014 - debe reenviar exitosamente el código', async () => {
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({ id: 1, email_verified: false });
            jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({});
            jest.spyOn(emailService, 'sendVerificationCode').mockResolvedValue(undefined);
            const result = await authService.resendVerification({ email: 'test@test.com' });
            expect(result).toEqual({
                success: true,
                message: 'Codigo reenviado. Revisa tu correo.',
            });
            expect(prismaService.usuarios.update).toHaveBeenCalled();
            expect(emailService.sendVerificationCode).toHaveBeenCalled();
        });
        it('CP-015 - debe arrojar NotFoundException si el correo no está registrado', async () => {
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue(null);
            await expect(authService.resendVerification({ email: 'noexist@test.com' })).rejects.toThrow(common_1.NotFoundException);
        });
        it('CP-016 - debe retornar éxito sin enviar correo si ya está verificado', async () => {
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({ id: 1, email_verified: true });
            const result = await authService.resendVerification({ email: 'test@test.com' });
            expect(result).toEqual({
                success: true,
                message: 'El correo ya esta verificado.',
            });
            expect(emailService.sendVerificationCode).not.toHaveBeenCalled();
        });
        it('CP-017 - debe propagar excepción si falla el envío de correo', async () => {
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({ id: 1, email_verified: false });
            jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({});
            const sendSpy = jest.spyOn(emailService, 'sendVerificationCode').mockRejectedValue(new Error('Mail Error'));
            await expect(authService.resendVerification({ email: 'test@test.com' })).rejects.toThrow(Error);
            expect(sendSpy).toHaveBeenCalled();
        });
        it('CP-018 - debe arrojar Error si falla la actualización en BD', async () => {
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({ id: 1, email_verified: false });
            const updateSpy = jest.spyOn(prismaService.usuarios, 'update').mockRejectedValue(new Error('DB Error'));
            const sendSpy = jest.spyOn(emailService, 'sendVerificationCode');
            await expect(authService.resendVerification({ email: 'test@test.com' })).rejects.toThrow(Error);
            expect(updateSpy).toHaveBeenCalled();
            expect(sendSpy).not.toHaveBeenCalled();
        });
    });
    describe('Inicio de Sesión', () => {
        const loginDto = { email: 'test@example.com', password: 'Password123!' };
        it('CP-019 - debe iniciar sesión correctamente para cliente verificado y generar token de acceso', async () => {
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({
                id: 1,
                password: 'hashed_password',
                id_rol: 3,
                email_verified: true,
                email: 'test@example.com',
                nombre: 'Test',
                apellido: 'User',
                roles: { nombre: 'Cliente' },
                tipos_identificacion: { nombre: 'CC' },
            });
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
            const updateSpy = jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({});
            const result = await authService.login(loginDto);
            expect(result).toEqual({
                success: true,
                message: 'Inicio de sesion exitoso',
                token: 'mocked_jwt_token',
                user: {
                    id: 1,
                    nombre: 'Test',
                    apellido: 'User',
                    email: 'test@example.com',
                    id_rol: 3,
                    email_verified: true,
                    rol: 'Cliente',
                    tipo_documento: 'CC',
                },
            });
            expect(updateSpy).toHaveBeenCalledWith({
                where: { id: 1 },
                data: {
                    login_two_factor_code: null,
                    login_two_factor_expires: null,
                },
            });
        });
        it('CP-026 - debe verificar que el sistema no solicite doble factor a los usuarios con rol Cliente', async () => {
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({
                id: 1,
                password: 'hashed_password',
                id_rol: 3,
                email_verified: true,
                email: 'test@example.com',
                nombre: 'Test',
                apellido: 'User',
                roles: { nombre: 'Cliente' },
                tipos_identificacion: { nombre: 'CC' },
            });
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
            const updateSpy = jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({});
            const result = await authService.login(loginDto);
            expect(result).toEqual(expect.objectContaining({
                success: true,
                token: 'mocked_jwt_token',
                user: expect.objectContaining({ rol: 'Cliente' }),
            }));
            expect(result.requiresTwoFactor).toBeUndefined();
            expect(updateSpy).toHaveBeenCalledWith({
                where: { id: 1 },
                data: {
                    login_two_factor_code: null,
                    login_two_factor_expires: null,
                },
            });
        });
        it('CP-020 - debe fallar si la contraseña es incorrecta', async () => {
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({
                id: 1,
                password: 'hashed_password',
                id_rol: 3,
                email_verified: true,
            });
            const compareSpy = jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);
            await expect(authService.login(loginDto)).rejects.toThrow(common_1.ForbiddenException);
            expect(compareSpy).toHaveBeenCalledWith(loginDto.password, 'hashed_password');
        });
        it('CP-021 - debe arrojar error si el correo no está registrado', async () => {
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue(null);
            await expect(authService.login(loginDto)).rejects.toThrow(common_1.NotFoundException);
        });
        it('CP-022 - debe impedir el inicio de sesión si el correo no está verificado', async () => {
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({
                id: 1,
                password: 'hashed_password',
                id_rol: 3,
                email_verified: false,
            });
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
            await expect(authService.login(loginDto)).rejects.toThrow(common_1.ForbiddenException);
        });
        it('CP-023 - debe validar campos obligatorios del inicio de sesión', async () => {
            const missingEmail = (0, class_transformer_1.plainToInstance)(login_dto_1.LoginDto, { password: 'Password123!' });
            const errorsEmail = await (0, class_validator_1.validate)(missingEmail);
            expect(errorsEmail.map(e => e.property)).toContain('email');
            const missingPassword = (0, class_transformer_1.plainToInstance)(login_dto_1.LoginDto, { email: 'test@example.com' });
            const errorsPassword = await (0, class_validator_1.validate)(missingPassword);
            expect(errorsPassword.map(e => e.property)).toContain('password');
            const missingBoth = (0, class_transformer_1.plainToInstance)(login_dto_1.LoginDto, {});
            const errorsBoth = await (0, class_validator_1.validate)(missingBoth);
            expect(errorsBoth.map(e => e.property)).toEqual(expect.arrayContaining(['email', 'password']));
        });
        it('CP-024 - debe iniciar el proceso 2FA para usuarios Administrador y Empleado', async () => {
            const userAdmin = {
                id: 2,
                password: 'hashed_password',
                id_rol: 1,
                email_verified: true,
                email: 'admin@test.com',
                nombre: 'Admin',
                apellido: 'User',
                roles: { nombre: 'Administrador' },
            };
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValueOnce(userAdmin);
            jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
            jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({});
            jest.spyOn(emailService, 'sendLoginTwoFactorCode').mockResolvedValue(undefined);
            const adminResult = await authService.login(loginDto);
            expect(adminResult).toEqual({
                success: true,
                message: 'Enviamos un codigo de segundo factor a tu correo para completar el inicio de sesion.',
                requiresTwoFactor: true,
                pendingToken: 'mocked_jwt_token',
                twoFactorExpiresInMinutes: expect.any(Number),
                user: {
                    id: 2,
                    email: 'admin@test.com',
                    id_rol: 1,
                    rol: 'Administrador',
                },
            });
            const userEmployee = {
                id: 3,
                password: 'hashed_password',
                id_rol: 2,
                email_verified: true,
                email: 'empleado@test.com',
                nombre: 'Empleado',
                apellido: 'User',
                roles: { nombre: 'Empleado' },
            };
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValueOnce(userEmployee);
            const employeeResult = await authService.login(loginDto);
            expect(employeeResult).toEqual({
                success: true,
                message: 'Enviamos un codigo de segundo factor a tu correo para completar el inicio de sesion.',
                requiresTwoFactor: true,
                pendingToken: 'mocked_jwt_token',
                twoFactorExpiresInMinutes: expect.any(Number),
                user: {
                    id: 3,
                    email: 'empleado@test.com',
                    id_rol: 2,
                    rol: 'Empleado',
                },
            });
        });
    });
    describe('Doble Factor (2FA)', () => {
        it('CP-025 - debe generar y enviar el código 2FA para administradores/empleados', async () => {
            const user = { id: 10, email: 'admin2@test.com', id_rol: 1, roles: { nombre: 'Administrador' } };
            const updateSpy = jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({});
            const sendSpy = jest.spyOn(emailService, 'sendLoginTwoFactorCode').mockResolvedValue(undefined);
            const res = await authService.createLoginTwoFactorChallenge(user);
            expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    login_two_factor_code: expect.any(String),
                    login_two_factor_expires: expect.any(Date),
                }),
            }));
            expect(sendSpy).toHaveBeenCalled();
            expect(res).toEqual(expect.objectContaining({ success: true, requiresTwoFactor: true, pendingToken: expect.any(String) }));
        });
        it('CP-027 - debe invalidar el código 2FA después de un uso exitoso', async () => {
            const pendingPayload = { sub: 20, email: 'user2@test.com', id_rol: 1, token_type: 'login_2fa' };
            jest.spyOn(jwtService, 'verify').mockReturnValue(pendingPayload);
            const code = '123456';
            const codeHash = crypto.createHash('sha256').update(code).digest('hex');
            const userWithCode = {
                id: 20,
                email: 'user2@test.com',
                id_rol: 1,
                login_two_factor_code: codeHash,
                login_two_factor_expires: new Date(Date.now() + 10000),
                roles: { nombre: 'Administrador' },
            };
            const userNoCode = {
                id: 20,
                email: 'user2@test.com',
                id_rol: 1,
                login_two_factor_code: null,
                login_two_factor_expires: null,
                roles: { nombre: 'Administrador' },
            };
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValueOnce(userWithCode).mockResolvedValueOnce(userNoCode);
            const updateSpy = jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({});
            const first = await authService.verifyLoginCode({ pendingToken: 'token', code });
            expect(first).toEqual(expect.objectContaining({ success: true, token: expect.any(String), user: expect.any(Object) }));
            expect(updateSpy).toHaveBeenCalledWith({ where: { id: 20 }, data: { login_two_factor_code: null, login_two_factor_expires: null } });
            await expect(authService.verifyLoginCode({ pendingToken: 'token', code })).rejects.toThrow(common_1.BadRequestException);
        });
        it('CP-028 - debe establecer una expiración futura válida para el código 2FA y rechazar expirados', async () => {
            const user = { id: 1, email: 'test@test.com' };
            jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({});
            jest.spyOn(emailService, 'sendLoginTwoFactorCode').mockResolvedValue(undefined);
            const res = await authService.createLoginTwoFactorChallenge(user);
            expect(prismaService.usuarios.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ login_two_factor_expires: expect.any(Date) }) }));
            expect(res).toBeDefined();
            const pendingPayload = { sub: 60, email: 'user6@test.com', id_rol: 1, token_type: 'login_2fa' };
            jest.spyOn(jwtService, 'verify').mockReturnValue(pendingPayload);
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({ id: 60, login_two_factor_code: 'hashed', login_two_factor_expires: new Date(Date.now() - 10000) });
            jest.spyOn(authService, 'clearLoginTwoFactorChallenge').mockResolvedValue({});
            await expect(authService.verifyLoginCode({ pendingToken: 'token', code: '123456' })).rejects.toThrow(common_1.BadRequestException);
        });
        it('CP-029 - debe limpiar el código y arrojar error 500 si falla el correo de 2FA', async () => {
            const user = { id: 1, email: 'test@test.com' };
            jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({});
            jest.spyOn(emailService, 'sendLoginTwoFactorCode').mockRejectedValue(new Error('Mail Error'));
            const clearSpy = jest.spyOn(authService, 'clearLoginTwoFactorChallenge').mockResolvedValue({});
            await expect(authService.createLoginTwoFactorChallenge(user)).rejects.toThrow(common_1.InternalServerErrorException);
            expect(clearSpy).toHaveBeenCalledWith(1);
        });
        it('CP-030 - debe rechazar un código 2FA incorrecto', async () => {
            const pendingPayload = { sub: 50, email: 'user5@test.com', id_rol: 1, token_type: 'login_2fa' };
            jest.spyOn(jwtService, 'verify').mockReturnValue(pendingPayload);
            const correctHash = crypto.createHash('sha256').update('123456').digest('hex');
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({
                id: 50,
                email: 'user5@test.com',
                id_rol: 1,
                login_two_factor_code: correctHash,
                login_two_factor_expires: new Date(Date.now() + 10000),
            });
            await expect(authService.verifyLoginCode({ pendingToken: 'token', code: '000000' })).rejects.toThrow(common_1.ForbiddenException);
        });
        it('CP-031 - debe completar el inicio de sesión con un código 2FA válido', async () => {
            const pendingPayload = { sub: 30, email: 'user3@test.com', id_rol: 1, token_type: 'login_2fa' };
            jest.spyOn(jwtService, 'verify').mockReturnValue(pendingPayload);
            const code = '123456';
            const codeHash = crypto.createHash('sha256').update(code).digest('hex');
            const user = {
                id: 30,
                email: 'user3@test.com',
                id_rol: 1,
                email_verified: true,
                login_two_factor_code: codeHash,
                login_two_factor_expires: new Date(Date.now() + 10000),
                nombre: 'Admin',
                apellido: 'User',
                roles: { nombre: 'Administrador' },
                tipos_identificacion: { nombre: 'CC' },
            };
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue(user);
            const updateSpy = jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({});
            const result = await authService.verifyLoginCode({ pendingToken: 'token', code });
            expect(result).toEqual(expect.objectContaining({ success: true, token: expect.any(String), user: expect.any(Object) }));
            expect(updateSpy).toHaveBeenCalledWith({ where: { id: 30 }, data: { login_two_factor_code: null, login_two_factor_expires: null } });
        });
        it('CP-032 - debe rechazar un código de doble factor incorrecto', async () => {
            const pendingPayload = { sub: 40, email: 'user4@test.com', id_rol: 1, token_type: 'login_2fa' };
            jest.spyOn(jwtService, 'verify').mockReturnValue(pendingPayload);
            const correctHash = crypto.createHash('sha256').update('123456').digest('hex');
            const updateSpy = jest.spyOn(prismaService.usuarios, 'update');
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({
                id: 40,
                email: 'user4@test.com',
                id_rol: 1,
                login_two_factor_code: correctHash,
                login_two_factor_expires: new Date(Date.now() + 10000),
            });
            await expect(authService.verifyLoginCode({ pendingToken: 'token', code: '000000' })).rejects.toThrow(common_1.ForbiddenException);
            expect(updateSpy).not.toHaveBeenCalled();
        });
        it('CP-033 - debe rechazar un código de doble factor expirado', async () => {
            const pendingPayload = { sub: 60, email: 'user6@test.com', id_rol: 1, token_type: 'login_2fa' };
            jest.spyOn(jwtService, 'verify').mockReturnValue(pendingPayload);
            const user = {
                id: 60,
                email: 'user6@test.com',
                id_rol: 1,
                login_two_factor_code: 'hashed',
                login_two_factor_expires: new Date(Date.now() - 10000),
                roles: { nombre: 'Administrador' },
            };
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue(user);
            const clearSpy = jest.spyOn(authService, 'clearLoginTwoFactorChallenge').mockResolvedValue({});
            await expect(authService.verifyLoginCode({ pendingToken: 'token', code: '123456' })).rejects.toThrow(common_1.BadRequestException);
            expect(clearSpy).toHaveBeenCalledWith(60);
        });
        it('CP-034 - debe validar la obligatoriedad del código de doble factor', async () => {
            const dto = (0, class_transformer_1.plainToInstance)(verify_login_code_dto_1.VerifyLoginCodeDto, { pendingToken: 'token', code: '' });
            const errors = await (0, class_validator_1.validate)(dto);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors.map(error => error.property)).toContain('code');
            expect(errors.find(error => error.property === 'code')?.constraints).toHaveProperty('isNotEmpty');
        });
        it('CP-035 - debe manejar error al consultar la información del usuario para verificación 2FA', async () => {
            const pendingPayload = { sub: 70, email: 'user7@test.com', id_rol: 1, token_type: 'login_2fa' };
            jest.spyOn(jwtService, 'verify').mockReturnValue(pendingPayload);
            jest.spyOn(prismaService.usuarios, 'findFirst').mockRejectedValue(new Error('DB Error'));
            await expect(authService.verifyLoginCode({ pendingToken: 'token', code: '123456' })).rejects.toThrow(Error);
        });
        describe('RF-001.7: Solicitar Recuperación de Contraseña', () => {
            it('CP-036 - debe solicitar correctamente la recuperación de contraseña para un correo registrado', async () => {
                const email = 'registered@test.com';
                const user = { id: 100 };
                const updateSpy = jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({});
                jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue(user);
                jest.spyOn(emailService, 'sendPasswordResetCode').mockResolvedValue(undefined);
                const result = await authService.requestPasswordReset({ email });
                expect(result).toEqual({ success: true, message: 'Si el correo existe, se envio un codigo.' });
                expect(prismaService.usuarios.findFirst).toHaveBeenCalledWith({ where: { email }, select: { id: true } });
                expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({
                    where: { id: 100 },
                    data: expect.objectContaining({
                        password_reset_code: expect.any(String),
                        password_reset_expires: expect.any(Date),
                    }),
                }));
                expect(emailService.sendPasswordResetCode).toHaveBeenCalledWith(email, expect.any(String), expect.any(Number));
            });
            it('CP-037 - debe retornar mensaje genérico cuando el correo no está registrado', async () => {
                const email = 'unknown@test.com';
                jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue(null);
                const updateSpy = jest.spyOn(prismaService.usuarios, 'update');
                const sendSpy = jest.spyOn(emailService, 'sendPasswordResetCode');
                const result = await authService.requestPasswordReset({ email });
                expect(result).toEqual({ success: true, message: 'Si el correo existe, se envio un codigo.' });
                expect(updateSpy).not.toHaveBeenCalled();
                expect(sendSpy).not.toHaveBeenCalled();
            });
            it('CP-038 - debe validar el campo correo electrónico para solicitar la recuperación de contraseña', async () => {
                const emptyDto = (0, class_transformer_1.plainToInstance)(request_password_reset_dto_1.RequestPasswordResetDto, { email: '' });
                const invalidDto = (0, class_transformer_1.plainToInstance)(request_password_reset_dto_1.RequestPasswordResetDto, { email: 'invalid-email' });
                const emptyErrors = await (0, class_validator_1.validate)(emptyDto);
                const invalidErrors = await (0, class_validator_1.validate)(invalidDto);
                expect(emptyErrors.map(e => e.property)).toContain('email');
                expect(emptyErrors.find(e => e.property === 'email')?.constraints).toHaveProperty('isEmail');
                expect(invalidErrors.map(e => e.property)).toContain('email');
                expect(invalidErrors.find(e => e.property === 'email')?.constraints).toHaveProperty('isEmail');
            });
            it('CP-039 - debe manejar el fallo al enviar el codigo de recuperación por correo', async () => {
                const email = 'registered@test.com';
                jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({ id: 101 });
                jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({});
                jest.spyOn(emailService, 'sendPasswordResetCode').mockRejectedValue(new Error('Mail Error'));
                await expect(authService.requestPasswordReset({ email })).rejects.toThrow(Error);
            });
            it('CP-040 - debe reemplazar el codigo anterior de recuperación con una nueva solicitud', async () => {
                const email = 'registered@test.com';
                const user = { id: 102 };
                const firstCode = '111111';
                const secondCode = '222222';
                const generateSpy = jest.spyOn(authService, 'generateCode').mockReturnValueOnce(firstCode).mockReturnValueOnce(secondCode);
                jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue(user);
                const updateSpy = jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({});
                jest.spyOn(emailService, 'sendPasswordResetCode').mockResolvedValue(undefined);
                await authService.requestPasswordReset({ email });
                await authService.requestPasswordReset({ email });
                expect(updateSpy).toHaveBeenLastCalledWith(expect.objectContaining({
                    where: { id: 102 },
                    data: expect.objectContaining({ password_reset_code: authService['hashCode'](secondCode) }),
                }));
                jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({
                    id: 102,
                    password_reset_code: authService['hashCode'](secondCode),
                    password_reset_expires: new Date(Date.now() + 10000),
                });
                await expect(authService.resetPassword({
                    email,
                    code: firstCode,
                    newPassword: 'NewPassword123!',
                    confirmPassword: 'NewPassword123!',
                })).rejects.toThrow(common_1.ForbiddenException);
                expect(generateSpy).toHaveBeenCalledTimes(2);
            });
        });
    });
    describe('RF-001.8: Reestablecer Contraseña', () => {
        it('CP-041 - debe restablecer correctamente la contraseña con un código válido', async () => {
            const email = 'test@test.com';
            const code = '123456';
            const newPassword = 'NewPassword123!';
            const user = {
                id: 100,
                email,
                password_reset_code: authService['hashCode'](code),
                password_reset_expires: new Date(Date.now() + 10000),
            };
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue(user);
            jest.spyOn(bcrypt, 'hash').mockResolvedValue('hashed_new_password');
            const actualizarCon = jest.spyOn(prismaService.usuarios, 'update').mockResolvedValue({});
            const result = await authService.resetPassword({
                email,
                code,
                newPassword,
                confirmPassword: newPassword,
            });
            expect(result).toEqual({
                success: true,
                message: 'Contrasena actualizada correctamente.',
            });
            expect(actualizarCon).toHaveBeenCalledWith({
                where: {
                    id: 100,
                },
                data: {
                    password: 'hashed_new_password',
                    password_reset_code: null,
                    password_reset_expires: null,
                },
            });
        });
        it('CP-042 - debe rechazar un código de recuperació incorrecto', async () => {
            const email = 'test@test.com';
            const code = '123456';
            const incorrectoCodigo = '000000';
            const nuevaPassword = 'NuevaPassword123!';
            const user = {
                id: 100,
                email,
                password_reset_code: authService['hashCode'](code),
                password_reset_expires: new Date(Date.now() + 10000),
            };
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue(user);
            const actualizarCon = jest.spyOn(prismaService.usuarios, 'update');
            await expect(authService.resetPassword({
                email,
                code: incorrectoCodigo,
                nuevaPassword,
                confirmPassword: nuevaPassword,
            })).rejects.toThrow(common_1.ForbiddenException);
            expect(actualizarCon).not.toHaveBeenCalled();
        });
        it('CP-043 - debe impedir restablecer la contraseña cuando el código ha expirado', async () => {
            const email = 'test@test.com';
            const code = '123456';
            const nuevaContrasena = 'NewPassword123!';
            const expiradoCodigo = authService['hashCode'](code);
            jest.spyOn(prismaService.usuarios, 'findFirst').mockResolvedValue({
                id: 100,
                email,
                password_reset_code: expiradoCodigo,
                password_reset_expires: new Date(Date.now() - 10000),
            });
            const actualizarCon = jest.spyOn(prismaService.usuarios, 'update');
            await expect(authService.resetPassword({
                email,
                code,
                nuevaContrasena,
                confirmPassword: nuevaContrasena,
            })).rejects.toThrow(common_1.BadRequestException);
            expect(actualizarCon).not.toHaveBeenCalled();
        });
        it('CP-044 - debe validar los requisitos de la nueva contraseña', async () => {
            const dto = (0, class_transformer_1.plainToInstance)(reset_password_dto_1.ResetPasswordDto, {
                email: 'test@test.com',
                code: '123456',
                newPassword: 'mala',
                confirmPassword: 'mala',
            });
            const errores = await (0, class_validator_1.validate)(dto);
            expect(errores.length).toBeGreaterThan(0);
            const contrasenaError = errores.find(error => error.property === 'newPassword');
            expect(contrasenaError).toBeDefined();
        });
        it('CP-045 - debe rechazar cuando faltan campos obligatorios', async () => {
            const dto = (0, class_transformer_1.plainToInstance)(reset_password_dto_1.ResetPasswordDto, {
                email: '',
                code: '',
                newPassword: '',
                confirmPassword: '',
            });
            const errores = await (0, class_validator_1.validate)(dto);
            expect(errores.length).toBeGreaterThanOrEqual(4);
            const emailError = errores.find(error => error.property === 'email');
            const codeError = errores.find(error => error.property === 'code');
            const newPasswordError = errores.find(error => error.property === 'newPassword');
            const confirmPasswordError = errores.find(error => error.property === 'confirmPassword');
            expect(emailError).toBeDefined();
            expect(codeError).toBeDefined();
            expect(newPasswordError).toBeDefined();
            expect(confirmPasswordError).toBeDefined();
        });
    });
    it('CP-047 - debe cerrar sesión correctamente', () => {
        const result = authService.logout();
        expect(result).toEqual({
            success: true,
            message: 'Sesion cerrada (token invalidado por el cliente)',
        });
    });
});
//# sourceMappingURL=auth.service.test.js.map