import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Papel } from '../usuarios/usuario.entity';
import { PapeisGuard } from './guards';

function contexto(papel?: Papel): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({
      getRequest: () => ({ user: papel ? { id: 1, papel } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('PapeisGuard', () => {
  const reflector = new Reflector();
  const guard = new PapeisGuard(reflector);

  it('libera rota sem @Papeis', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    expect(guard.canActivate(contexto('CLIENTE'))).toBe(true);
  });

  it('libera papel permitido', () => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockReturnValue(['ADMIN', 'FUNCIONARIO']);
    expect(guard.canActivate(contexto('FUNCIONARIO'))).toBe(true);
  });

  it('bloqueia papel não permitido', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ADMIN']);
    expect(() => guard.canActivate(contexto('CLIENTE'))).toThrow(
      ForbiddenException,
    );
  });
});
