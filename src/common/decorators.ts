import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { Request } from 'express';
import { Papel } from '../usuarios/usuario.entity';

export interface UsuarioAutenticado {
  id: number;
  nome: string;
  email: string;
  papel: Papel;
}

export const ROTA_PUBLICA = 'rotaPublica';
/** Libera a rota sem token JWT. */
export const Publico = () => SetMetadata(ROTA_PUBLICA, true);

export const PAPEIS_PERMITIDOS = 'papeisPermitidos';
/** Restringe a rota aos papéis informados. */
export const Papeis = (...papeis: Papel[]) =>
  SetMetadata(PAPEIS_PERMITIDOS, papeis);

/** Injeta o usuário autenticado (preenchido pelo JwtStrategy). */
export const UsuarioAtual = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): UsuarioAutenticado => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return req.user as UsuarioAutenticado;
  },
);

export function ehEquipe(usuario: UsuarioAutenticado): boolean {
  return usuario.papel === 'ADMIN' || usuario.papel === 'FUNCIONARIO';
}
