"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_1 = require("@nestjs/testing");
const auth_controller_1 = require("../../../src/auth/auth.controller");
const auth_service_1 = require("../../../src/auth/auth.service");
describe('AuthController (Unitarias)', () => {
    let controller;
    let authService;
    const mockAuthService = {
        getDocumentTypes: jest.fn(),
        register: jest.fn(),
        login: jest.fn(),
        verifyLoginCode: jest.fn(),
        verifyEmail: jest.fn(),
        resendVerification: jest.fn(),
        requestPasswordReset: jest.fn(),
        resetPassword: jest.fn(),
        logout: jest.fn(),
    };
    beforeEach(async () => {
        const module = await testing_1.Test.createTestingModule({
            controllers: [auth_controller_1.AuthController],
            providers: [
                {
                    provide: auth_service_1.AuthService,
                    useValue: mockAuthService,
                },
            ],
        }).compile();
        controller = module.get(auth_controller_1.AuthController);
        authService = module.get(auth_service_1.AuthService);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('getDocumentTypes', () => {
        it('debe obtener los tipos de identificación llamando al servicio', async () => {
            const mockResult = [{ id: 1, nombre: 'CC' }];
            mockAuthService.getDocumentTypes.mockResolvedValue(mockResult);
            const result = await controller.getDocumentTypes();
            expect(authService.getDocumentTypes).toHaveBeenCalled();
            expect(result).toEqual(mockResult);
        });
    });
    describe('register', () => {
        it('debe registrar un usuario llamando al servicio con el DTO', async () => {
            const dto = {
                nombre: 'Juan',
                apellido: 'Perez',
                email: 'juan@test.com',
                password: 'Password123!',
                direccion: 'Calle 123',
                fecha_nacimiento: '1995-05-05',
                id_tipo_identificacion: 1,
                numero_identificacion: '1234567890',
            };
            const mockResult = { success: true, message: 'Usuario registrado correctamente' };
            mockAuthService.register.mockResolvedValue(mockResult);
            const result = await controller.register(dto);
            expect(authService.register).toHaveBeenCalledWith(dto);
            expect(result).toEqual(mockResult);
        });
    });
    describe('login', () => {
        it('debe iniciar sesión y establecer la cookie de access_token cuando devuelve un token', async () => {
            const dto = { email: 'juan@test.com', password: 'Password123!' };
            const mockResult = { success: true, token: 'mocked_jwt_token', usuario: { id: 1, id_rol: 3 } };
            mockAuthService.login.mockResolvedValue(mockResult);
            const mockReq = { secure: false, headers: {} };
            const mockRes = { cookie: jest.fn() };
            const result = await controller.login(dto, mockReq, mockRes);
            expect(authService.login).toHaveBeenCalledWith(dto);
            expect(mockRes.cookie).toHaveBeenCalledWith('access_token', 'mocked_jwt_token', expect.objectContaining({
                httpOnly: true,
                path: '/',
            }));
            expect(result).toEqual(mockResult);
        });
        it('debe iniciar sesión en HTTPS y establecer cookie con secure y sameSite none', async () => {
            const dto = { email: 'juan@test.com', password: 'Password123!' };
            const mockResult = { success: true, token: 'mocked_jwt_token' };
            mockAuthService.login.mockResolvedValue(mockResult);
            const mockReq = { secure: false, headers: { 'x-forwarded-proto': 'https' } };
            const mockRes = { cookie: jest.fn() };
            const result = await controller.login(dto, mockReq, mockRes);
            expect(mockRes.cookie).toHaveBeenCalledWith('access_token', 'mocked_jwt_token', expect.objectContaining({
                secure: true,
                sameSite: 'none',
            }));
            expect(result).toEqual(mockResult);
        });
        it('debe retornar pendingToken sin establecer cookie de token si requiere 2FA', async () => {
            const dto = { email: 'admin@test.com', password: 'Password123!' };
            const mockResult = { success: true, requires2FA: true, pendingToken: 'mocked_pending_token' };
            mockAuthService.login.mockResolvedValue(mockResult);
            const mockReq = { secure: false, headers: {} };
            const mockRes = { cookie: jest.fn() };
            const result = await controller.login(dto, mockReq, mockRes);
            expect(authService.login).toHaveBeenCalledWith(dto);
            expect(mockRes.cookie).not.toHaveBeenCalled();
            expect(result).toEqual(mockResult);
        });
    });
    describe('verifyLoginCode', () => {
        it('debe verificar el código 2FA y establecer la cookie de access_token', async () => {
            const dto = { pendingToken: 'token123', code: '123456' };
            const mockResult = { success: true, token: 'mocked_jwt_token' };
            mockAuthService.verifyLoginCode.mockResolvedValue(mockResult);
            const mockReq = { secure: false, headers: {} };
            const mockRes = { cookie: jest.fn() };
            const result = await controller.verifyLoginCode(dto, mockReq, mockRes);
            expect(authService.verifyLoginCode).toHaveBeenCalledWith(dto);
            expect(mockRes.cookie).toHaveBeenCalledWith('access_token', 'mocked_jwt_token', expect.any(Object));
            expect(result).toEqual(mockResult);
        });
    });
    describe('verifyEmail', () => {
        it('debe delegar la verificación del correo al servicio', async () => {
            const dto = { email: 'juan@test.com', code: '123456' };
            const mockResult = { success: true, message: 'Correo verificado' };
            mockAuthService.verifyEmail.mockResolvedValue(mockResult);
            const result = await controller.verifyEmail(dto);
            expect(authService.verifyEmail).toHaveBeenCalledWith(dto);
            expect(result).toEqual(mockResult);
        });
    });
    describe('resendVerification', () => {
        it('debe delegar el reenvío de verificación al servicio', async () => {
            const dto = { email: 'juan@test.com' };
            const mockResult = { success: true, message: 'Código reenviado' };
            mockAuthService.resendVerification.mockResolvedValue(mockResult);
            const result = await controller.resendVerification(dto);
            expect(authService.resendVerification).toHaveBeenCalledWith(dto);
            expect(result).toEqual(mockResult);
        });
    });
    describe('requestPasswordReset', () => {
        it('debe delegar la solicitud de recuperación de contraseña al servicio', async () => {
            const dto = { email: 'juan@test.com' };
            const mockResult = { success: true, message: 'Código de recuperación enviado' };
            mockAuthService.requestPasswordReset.mockResolvedValue(mockResult);
            const result = await controller.requestPasswordReset(dto);
            expect(authService.requestPasswordReset).toHaveBeenCalledWith(dto);
            expect(result).toEqual(mockResult);
        });
    });
    describe('resetPassword', () => {
        it('debe delegar el restablecimiento de contraseña al servicio', async () => {
            const dto = { email: 'juan@test.com', code: '123456', newPassword: 'NewPassword123!', confirmPassword: 'NewPassword123!' };
            const mockResult = { success: true, message: 'Contraseña restablecida' };
            mockAuthService.resetPassword.mockResolvedValue(mockResult);
            const result = await controller.resetPassword(dto);
            expect(authService.resetPassword).toHaveBeenCalledWith(dto);
            expect(result).toEqual(mockResult);
        });
    });
    describe('logout', () => {
        it('debe limpiar la cookie access_token y llamar al logout del servicio', () => {
            const mockReq = { secure: false, headers: {} };
            const mockRes = { clearCookie: jest.fn() };
            const mockResult = { success: true, message: 'Sesión cerrada' };
            mockAuthService.logout.mockReturnValue(mockResult);
            const result = controller.logout(mockReq, mockRes);
            expect(mockRes.clearCookie).toHaveBeenCalledWith('access_token', expect.objectContaining({ path: '/' }));
            expect(authService.logout).toHaveBeenCalled();
            expect(result).toEqual(mockResult);
        });
    });
});
//# sourceMappingURL=auth.controller.test.js.map