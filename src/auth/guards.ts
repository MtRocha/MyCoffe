import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';
import {
  PAPEIS_PERMITIDOS,
  ROTA_PUBLICA,
  UsuarioAutenticado,
} from '../common/decorators';
import { Papel } from '../usuarios/usuario.entity';

/** Guard global: toda rota exige JWT, exceto as marcadas com @Publico(). */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(ctx: ExecutionContext) {
    const publica = this.reflector.getAllAndOverride<boolean>(ROTA_PUBLICA, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    return publica ? true : super.canActivate(ctx);
  }
}

/** Guard global: confere @Papeis() quando presente. */
@Injectable()
export class PapeisGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const papeis = this.reflector.getAllAndOverride<Papel[] | undefined>(
      PAPEIS_PERMITIDOS,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!papeis?.length) return true;
    const usuario = ctx.switchToHttp().getRequest<Request>().user as
      UsuarioAutenticado | undefined;
    if (!usuario || !papeis.includes(usuario.papel)) {
      throw new ForbiddenException('Acesso restrito');
    }
    return true;
  }
}
