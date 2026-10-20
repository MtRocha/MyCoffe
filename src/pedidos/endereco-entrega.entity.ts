import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { Pedido } from './pedido.entity';

@Entity({ name: 'endereco_entrega', schema: 'dbo' })
export class EnderecoEntrega {
  @PrimaryColumn({ name: 'pedido_id', type: 'bigint' })
  pedidoId: string;

  @OneToOne(() => Pedido, (pedido) => pedido.endereco, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'pedido_id' })
  pedido: Pedido;

  @Column({ type: 'char', length: 8 })
  cep: string;

  @Column({ type: 'nvarchar', length: 120 })
  logradouro: string;

  @Column({ type: 'varchar', length: 10 })
  numero: string;

  @Column({ type: 'nvarchar', length: 60, nullable: true })
  complemento: string | null;

  @Column({ type: 'nvarchar', length: 60 })
  bairro: string;

  @Column({ type: 'nvarchar', length: 60 })
  cidade: string;

  @Column({ type: 'char', length: 2 })
  uf: string;
}
