import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { UsuarioRespostaDto } from '../../usuarios/dto/usuario-resposta.dto';

const normalizarEmail = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim().toLowerCase() : value;

export class CadastroDto {
  /** @example "Maria Silva" */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(2, 100)
  nome: string;

  /** @example "maria@email.com" */
  @Transform(normalizarEmail)
  @IsEmail()
  @MaxLength(254)
  email: string;

  /** Mínimo 8 caracteres, com letras e números. */
  @IsString()
  @Length(8, 72)
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'senha deve conter letras e números',
  })
  senha: string;

  /** Apenas dígitos: DDD + número. @example "11988887777" */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/\D/g, '') : value,
  )
  @Matches(/^\d{10,11}$/, { message: 'telefone deve ter 10 ou 11 dígitos' })
  telefone?: string;
}

export class RespostaAutenticacaoDto {
  /** JWT para o header Authorization: Bearer <token>. */
  accessToken: string;

  usuario: UsuarioRespostaDto;
}

export class LoginDto {
  /** @example "cliente@email.com" */
  @Transform(normalizarEmail)
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  senha: string;
}
