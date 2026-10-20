import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import { PAPEIS, type Papel } from '../usuario.entity';

export class AtualizarUsuarioDto {
  @IsOptional()
  @IsIn(PAPEIS)
  papel?: Papel;

  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class FiltroUsuariosDto {
  @IsOptional()
  @IsIn(PAPEIS)
  papel?: Papel;
}
