import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { decimalParaNumero, guidMinusculo } from '../common/transformers';
import { FormaPagamento } from '../pagamentos/forma-pagamento.entity';
import { Usuario } from '../usuarios/usuario.entity';
import { EnderecoEntrega } from './endereco-entrega.entity';
import { ItemPedido } from './item-pedido.entity';

export const STATUS_PEDIDO = [
  'CONFIRMADO',
  'EM_PREPARO',
  'SAIU_PARA_ENTREGA',
  'ENTREGUE',
  'CANCELADO',
] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];

@Entity({ name: 'pedido', schema: 'dbo' })
export class Pedido {
  /** BIGINT chega como string no driver mssql. */
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: string;

  /** Identificador público usado nas URLs. */
  @Column({ type: 'uniqueidentifier', transformer: guidMinusculo })
  codigo: string;

  @Column({ name: 'usuario_id', type: 'int' })
  usuarioId: number;

  @ManyToOne(() => Usuario)
  @JoinColumn({ name: 'usuario_id' })
  usuario: Usuario;

  @Column({ name: 'forma_pagamento_id', type: 'tinyint' })
  formaPagamentoId: number;

  @ManyToOne(() => FormaPagamento)
  @JoinColumn({ name: 'forma_pagamento_id' })
  formaPagamento: FormaPagamento;

  @Column({ type: 'varchar', length: 20 })
  status: StatusPedido;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: decimalParaNumero,
  })
  subtotal: number;

  @Column({
    name: 'taxa_entrega',
    type: 'decimal',
    precision: 6,
    scale: 2,
    transformer: decimalParaNumero,
  })
  taxaEntrega: number;

  /** Coluna computada (subtotal + taxa_entrega) PERSISTED. */
  @Column({
    type: 'decimal',
    precision: 11,
    scale: 2,
    insert: false,
    update: false,
    transformer: decimalParaNumero,
  })
  total: number;

  @Column({ name: 'previsao_min', type: 'tinyint' })
  previsaoMin: number;

  @Column({ name: 'previsao_max', type: 'tinyint' })
  previsaoMax: number;

  @Column({
    name: 'criado_em',
    type: 'datetime2',
    precision: 0,
    insert: false,
    update: false,
  })
  criadoEm: Date;

  @OneToMany(() => ItemPedido, (item) => item.pedido)
  itens: ItemPedido[];

  @OneToOne(() => EnderecoEntrega, (endereco) => endereco.pedido)
  endereco: EnderecoEntrega;
}
