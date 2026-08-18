"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const jwt_strategy_1 = require("../../../src/auth/strategies/jwt.strategy");
describe('JwtStrategy (Unitarias)', () => {
    let strategy;
    beforeEach(() => {
        strategy = new jwt_strategy_1.JwtStrategy();
    });
    describe('validate', () => {
        it('debe validar y retornar AuthUser si el payload es válido', () => {
            const payload = {
                sub: '123',
                email: 'user@test.com',
                id_rol: 3,
                token_type: 'access',
            };
            const result = strategy.validate(payload);
            expect(result).toEqual({
                id: 123,
                email: 'user@test.com',
                id_rol: 3,
            });
        });
        it('debe lanzar UnauthorizedException si sub es indefinido o nulo', () => {
            const payloadNullSub = { sub: null, email: 'user@test.com', id_rol: 3, token_type: 'access' };
            expect(() => strategy.validate(payloadNullSub)).toThrow(common_1.UnauthorizedException);
            const payloadUndefinedSub = { sub: undefined, email: 'user@test.com', id_rol: 3, token_type: 'access' };
            expect(() => strategy.validate(payloadUndefinedSub)).toThrow(common_1.UnauthorizedException);
        });
        it('debe lanzar UnauthorizedException si email no está presente', () => {
            const payload = { sub: '123', email: '', id_rol: 3, token_type: 'access' };
            expect(() => strategy.validate(payload)).toThrow(common_1.UnauthorizedException);
        });
        it('debe lanzar UnauthorizedException si id_rol es indefinido', () => {
            const payload = { sub: '123', email: 'user@test.com', id_rol: undefined, token_type: 'access' };
            expect(() => strategy.validate(payload)).toThrow(common_1.UnauthorizedException);
        });
        it('debe lanzar UnauthorizedException si token_type no es "access"', () => {
            const payload = { sub: '123', email: 'user@test.com', id_rol: 3, token_type: 'refresh' };
            expect(() => strategy.validate(payload)).toThrow(common_1.UnauthorizedException);
        });
    });
    describe('jwtFromRequest (Extracción de Token)', () => {
        it('debe extraer el token desde las cookies si está presente', () => {
            const jwtFromRequestExtractor = strategy._jwtFromRequest;
            const req = {
                cookies: { access_token: 'cookie_token_value' },
            };
            const token = jwtFromRequestExtractor(req);
            expect(token).toBe('cookie_token_value');
        });
        it('debe extraer el token desde el header Authorization Bearer si no hay cookie', () => {
            const jwtFromRequestExtractor = strategy._jwtFromRequest;
            const req = {
                cookies: {},
                headers: { authorization: 'Bearer bearer_token_value' },
            };
            const token = jwtFromRequestExtractor(req);
            expect(token).toBe('bearer_token_value');
        });
        it('debe retornar null si no hay cookie ni header Authorization Bearer', () => {
            const jwtFromRequestExtractor = strategy._jwtFromRequest;
            const req = {
                cookies: {},
                headers: {},
            };
            const token = jwtFromRequestExtractor(req);
            expect(token).toBeFalsy();
        });
    });
});
//# sourceMappingURL=jwt.strategy.test.js.map