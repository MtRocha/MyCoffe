import { type Papel, PAPEIS } from '../usuario.entity';
import { ApiProperty } from '@nestjs/swagger';

/** Usuário como a API devolve (nunca inclui o hash da senha). */
export class UsuarioRespostaDto {
  /** @example 3 */
  id: number;

  /** @example "Cliente Exemplo" */
  nome: string;

  /** @example "cliente@email.com" */
  email: string;

  /** @example "11988887777" */
  telefone: string | null;

  @ApiProperty({ enum: PAPEIS, example: 'CLIENTE' })
  papel: Papel;

  ativo: boolean;

  ultimoLoginEm: Date | null;

  criadoEm: Date;

  atualizadoEm: Date;
}
