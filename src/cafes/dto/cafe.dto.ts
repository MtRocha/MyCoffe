import { PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CriarCafeDto {
  /** @example "Cold Brew" */
  @Transform(aparar)
  @IsString()
  @Length(2, 60)
  nome: string;

  /** @example "Café extraído a frio por 12 horas" */
  @Transform(aparar)
  @IsString()
  @Length(2, 255)
  descricao: string;

  /** @example 12.5 */
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999.99)
  preco: number;

  /** @example "/img/cold-brew.png" */
  @IsString()
  @Length(1, 255)
  imagemUrl: string;

  /** IDs das tags (GET /tags). @example [1, 2] */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsInt({ each: true })
  tagIds?: number[];
}

export class AtualizarCafeDto extends PartialType(CriarCafeDto) {
  /** Reativa ou desativa o café no catálogo. */
  @IsOptional()
  @IsBoolean()
  ativo?: boolean;
}

export class FiltroCafesDto {
  /** Nome da tag. @example "Gelado" */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  tag?: string;

  /** Busca por parte do nome. @example "expresso" */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  busca?: string;
}

export class RecomendacoesDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(14)
  limite: number = 3;
}

export class CriarTagDto {
  /** @example "Sem lactose" */
  @Transform(aparar)
  @IsString()
  @Length(2, 30)
  nome: string;
}
