import { RolesGuard } from './roles.guard';
import { ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let mockExecutionContext: ExecutionContext;
  let mockRequest: any;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    guard = new RolesGuard(reflector);

    mockRequest = {};

    mockExecutionContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: () => mockRequest,
      }),
    } as any;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true if no roles are required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const result = guard.canActivate(mockExecutionContext);

    expect(result).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalled();
  });

  it('should throw UnauthorizedException if user is not in the request', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([1, 2]); // Roles required
    mockRequest.user = undefined;

    expect(() => guard.canActivate(mockExecutionContext)).toThrow(
      new UnauthorizedException('Usuario no esta autenticado')
    );
  });

  it('should throw ForbiddenException if user has a role that is not required', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([1, 2]); // Roles required
    mockRequest.user = { id: 1, id_rol: 3 }; // User role is 3

    expect(() => guard.canActivate(mockExecutionContext)).toThrow(
      new ForbiddenException('Usuario no tiene permiso para acceder a este recurso')
    );
  });

  it('should return true if user has one of the required roles', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue([1, 2]); // Roles required
    mockRequest.user = { id: 1, id_rol: 2 }; // User role is 2

    const result = guard.canActivate(mockExecutionContext);

    expect(result).toBe(true);
  });
});
