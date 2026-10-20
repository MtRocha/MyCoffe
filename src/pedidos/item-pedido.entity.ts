import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { Cafe } from '../cafes/cafe.entity';
import { decimalParaNumero } from '../common/transformers';
import { Pedido } from './pedido.entity';

@Entity({ name: 'item_pedido', schema: 'dbo' })
export class ItemPedido {
  @PrimaryColumn({ name: 'pedido_id', type: 'bigint' })
  pedidoId: string;

  @PrimaryColumn({ name: 'cafe_id', type: 'smallint' })
  cafeId: number;

  @ManyToOne(() => Pedido, (pedido) => pedido.itens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pedido_id' })
  pedido: Pedido;

  @ManyToOne(() => Cafe)
  @JoinColumn({ name: 'cafe_id' })
  cafe: Cafe;

  @Column({ type: 'tinyint' })
  quantidade: number;

  /** Cópia do preço no momento da compra. */
  @Column({
    name: 'preco_unitario',
    type: 'decimal',
    precision: 6,
    scale: 2,
    transformer: decimalParaNumero,
  })
  precoUnitario: number;

  /** Coluna computada (quantidade * preco_unitario) PERSISTED. */
  @Column({
    type: 'decimal',
    precision: 8,
    scale: 2,
    insert: false,
    update: false,
    transformer: decimalParaNumero,
  })
  subtotal: number;
}
