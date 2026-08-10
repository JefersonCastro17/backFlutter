import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { RolesGuard } from '../../../src/auth/guards/roles.guard';

describe('RolesGuard (Unitarias)', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let context: any;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
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

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
