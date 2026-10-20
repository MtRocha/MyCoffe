import { ApiProperty } from '@nestjs/swagger';
import { PAPEIS, type Papel } from '../../usuarios/usuario.entity';
import { STATUS_PEDIDO, type StatusPedido } from '../pedido.entity';

export class FormaPagamentoResumoDto {
  /** @example 1 */
  id: number;

  /** @example "CARTAO_CREDITO" */
  codigo: string;

  /** @example "Cartão de crédito" */
  descricao: string;
}

export class ItemPedidoRespostaDto {
  /** @example 6 */
  cafeId: number;

  /** @example "Latte" */
  nome: string;

  /** @example "/img/latte.png" */
  imagemUrl: string;

  /** @example 2 */
  quantidade: number;

  /** Preço no momento da compra. @example 9.9 */
  precoUnitario: number;

  /** @example 19.8 */
  subtotal: number;
}

export class EnderecoRespostaDto {
  /** @example "09390120" */
  cep: string;

  /** @example "Av. Antônia Rosa Fioravanti" */
  logradouro: string;

  /** @example "804" */
  numero: string;

  /** @example "Fatec Mauá" */
  complemento: string | null;

  /** @example "Centro" */
  bairro: string;

  /** @example "Mauá" */
  cidade: string;

  /** @example "SP" */
  uf: string;
}

export class ClienteResumoDto {
  /** @example 3 */
  id: number;

  /** @example "Cliente Exemplo" */
  nome: string;

  /** @example "cliente@email.com" */
  email: string;

  /** @example "11988887777" */
  telefone: string | null;
}

export class PedidoRespostaDto {
  /** Identificador público do pedido (usado nas URLs). */
  @ApiProperty({ format: 'uuid' })
  codigo: string;

  @ApiProperty({ enum: STATUS_PEDIDO, example: 'CONFIRMADO' })
  status: StatusPedido;

  criadoEm: Date;

  /** Soma dos itens. @example 29.7 */
  subtotal: number;

  /** @example 3.5 */
  taxaEntrega: number;

  /** subtotal + taxaEntrega. @example 33.2 */
  total: number;

  /** Previsão de entrega em minutos. @example 20 */
  previsaoMin: number;

  /** @example 30 */
  previsaoMax: number;

  formaPagamento: FormaPagamentoResumoDto;

  itens: ItemPedidoRespostaDto[];

  endereco: EnderecoRespostaDto | null;

  /** Só aparece para a equipe (FUNCIONARIO/ADMIN). */
  cliente?: ClienteResumoDto;
}

export class AlteradoPorDto {
  /** @example 2 */
  id: number;

  /** @example "Barista Exemplo" */
  nome: string;

  @ApiProperty({ enum: PAPEIS, example: 'FUNCIONARIO' })
  papel: Papel;
}

export class EventoHistoricoDto {
  @ApiProperty({ enum: STATUS_PEDIDO, example: 'EM_PREPARO' })
  status: StatusPedido;

  @ApiProperty({ enum: STATUS_PEDIDO, nullable: true, example: 'CONFIRMADO' })
  statusAnterior: StatusPedido | null;

  dataHora: Date;

  /** Quem fez a mudança (vem do log de auditoria). */
  alteradoPor: AlteradoPorDto | null;
}
