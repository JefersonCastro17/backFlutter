"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const common_1 = require("@nestjs/common");
const roles_guard_1 = require("../../../src/auth/guards/roles.guard");
describe('RolesGuard (Unitarias)', () => {
    let guard;
    let reflector;
    let context;
    beforeEach(() => {
        reflector = new core_1.Reflector();
        guard = new roles_guard_1.RolesGuard(reflector);
        context = {
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: () => ({ user: { id_rol: 2 } }),
            }),
            getHandler: jest.fn(),
            getClass: jest.fn(),
        };
    });
    it('CP-053 - debe denegar el acceso si el usuario no es administrador', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([1]);
        expect(() => guard.canActivate(context)).toThrow(common_1.ForbiddenException);
    });
    it('CP-066 - debe denegar la eliminación de usuarios si el usuario no tiene permisos de administrador', () => {
        jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([1]);
        expect(() => guard.canActivate(context)).toThrow(common_1.ForbiddenException);
    });
});
//# sourceMappingURL=roles.guard.test.js.map