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

/** multipart/form-data entrega tudo como texto: aceita "1,2", "[1,2]" ou campo repetido. */
const paraListaDeNumeros = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === '') return undefined;
  let lista: unknown[];
  if (Array.isArray(value)) lista = value;
  else if (typeof value === 'string' && value.trim().startsWith('[')) {
    try {
      lista = JSON.parse(value) as unknown[];
    } catch {
      return value;
    }
  } else if (typeof value === 'string') lista = value.split(',');
  else if (typeof value === 'number') lista = [value];
  else return value;
  return lista.map((v) =>
    typeof v === 'string' && v.trim() !== '' ? Number(v) : v,
  );
};

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
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(9999.99)
  preco: number;

  /**
   * URL da imagem. Normalmente preenchida pela API a partir do arquivo enviado
   * no campo `imagem`; só informe aqui se a imagem já estiver hospedada.
   * @example "https://mycoffestorage.blob.core.windows.net/images/cafes/cold-brew.png"
   */
  @IsOptional()
  @IsString()
  @Length(1, 255)
  imagemUrl?: string;

  /** IDs das tags (GET /tags). @example [1, 2] */
  @IsOptional()
  @Transform(paraListaDeNumeros)
  @IsArray()
  @ArrayMaxSize(20)
  @ArrayUnique()
  @IsInt({ each: true })
  tagIds?: number[];
}

export class AtualizarCafeDto extends PartialType(CriarCafeDto) {
  /** Reativa ou desativa o café no catálogo. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
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
