"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const jwt_auth_guard_1 = require("../../../src/auth/guards/jwt-auth.guard");
const passport_1 = require("@nestjs/passport");
describe('JwtAuthGuard (Unitarias)', () => {
    let guard;
    let reflector;
    beforeEach(() => {
        reflector = new core_1.Reflector();
        guard = new jwt_auth_guard_1.JwtAuthGuard(reflector);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    it('debe retornar true si el método de la solicitud es OPTIONS (preflight CORS)', () => {
        const mockContext = {
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: () => ({ method: 'OPTIONS' }),
            }),
            getHandler: jest.fn(),
            getClass: jest.fn(),
        };
        const result = guard.canActivate(mockContext);
        expect(result).toBe(true);
    });
    it('debe retornar true si la ruta tiene el decorador @Public()', () => {
        const mockContext = {
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: () => ({ method: 'GET' }),
            }),
            getHandler: jest.fn(),
            getClass: jest.fn(),
        };
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
        const result = guard.canActivate(mockContext);
        expect(result).toBe(true);
        expect(reflector.getAllAndOverride).toHaveBeenCalled();
    });
    it('debe llamar a super.canActivate si la ruta no es pública ni OPTIONS', () => {
        const mockContext = {
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: () => ({ method: 'GET' }),
            }),
            getHandler: jest.fn(),
            getClass: jest.fn(),
        };
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
        const superCanActivateSpy = jest.spyOn((0, passport_1.AuthGuard)('jwt').prototype, 'canActivate').mockReturnValue(true);
        const result = guard.canActivate(mockContext);
        expect(reflector.getAllAndOverride).toHaveBeenCalled();
        expect(superCanActivateSpy).toHaveBeenCalledWith(mockContext);
        expect(result).toBe(true);
    });
});
//# sourceMappingURL=jwt-auth.guard.test.js.map