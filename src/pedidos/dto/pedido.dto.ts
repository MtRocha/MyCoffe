import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsIn,
  IsObject,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { STATUS_PEDIDO, type StatusPedido } from '../pedido.entity';

export const UFS = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
] as const;

const aparar = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ItemPedidoDto {
  /** @example 1 */
  @IsInt()
  @Min(1)
  cafeId: number;

  /** @example 2 */
  @IsInt()
  @Min(1)
  @Max(99)
  quantidade: number;
}

export class EnderecoDto {
  /** Aceita com ou sem hífen. @example "09390-120" */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/\D/g, '') : value,
  )
  @Matches(/^\d{8}$/, { message: 'cep deve ter 8 dígitos' })
  cep: string;

  /** @example "Av. Antônia Rosa Fioravanti" */
  @Transform(aparar)
  @IsString()
  @Length(1, 120)
  logradouro: string;

  /** @example "804" */
  @Transform(aparar)
  @IsString()
  @Length(1, 10)
  numero: string;

  /** @example "Fatec Mauá" */
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @MaxLength(60)
  complemento?: string;

  /** @example "Centro" */
  @Transform(aparar)
  @IsString()
  @Length(1, 60)
  bairro: string;

  /** @example "Mauá" */
  @Transform(aparar)
  @IsString()
  @Length(1, 60)
  cidade: string;

  /** @example "SP" */
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(UFS)
  uf: string;
}

export class CriarPedidoDto {
  /** ID de GET /formas-pagamento. @example 1 */
  @IsInt()
  @Min(1)
  formaPagamentoId: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ItemPedidoDto)
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  itens: ItemPedidoDto[];

  // ValidateNested sozinho deixa passar undefined
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => EnderecoDto)
  endereco: EnderecoDto;
}

export class AtualizarStatusDto {
  @IsIn(STATUS_PEDIDO)
  status: StatusPedido;
}

export class FiltroPedidosDto {
  @IsOptional()
  @IsIn(STATUS_PEDIDO)
  status?: StatusPedido;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limite: number = 20;
}
