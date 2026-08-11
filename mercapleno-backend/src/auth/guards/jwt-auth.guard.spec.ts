import { JwtAuthGuard } from './jwt-auth.guard';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;
  let mockExecutionContext: ExecutionContext;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as any;

    guard = new JwtAuthGuard(reflector);

    mockExecutionContext = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should return true if the route is public', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

    const result = await guard.canActivate(mockExecutionContext);

    expect(result).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalled();
  });

  it('should call super.canActivate if the route is not public', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
    
    // Spy on the super.canActivate method
    const superCanActivateSpy = jest
      .spyOn(AuthGuard('jwt').prototype, 'canActivate')
      .mockReturnValue(true);

    const result = await guard.canActivate(mockExecutionContext);

    expect(result).toBe(true);
    expect(reflector.getAllAndOverride).toHaveBeenCalled();
    expect(superCanActivateSpy).toHaveBeenCalledWith(mockExecutionContext);

    superCanActivateSpy.mockRestore();
  });
});
