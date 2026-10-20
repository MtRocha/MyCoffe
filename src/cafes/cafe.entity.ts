import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { decimalParaNumero } from '../common/transformers';
import { Tag } from './tag.entity';

@Entity({ name: 'cafe', schema: 'dbo' })
export class Cafe {
  @PrimaryGeneratedColumn({ type: 'smallint' })
  id: number;

  @Column({ type: 'nvarchar', length: 60 })
  nome: string;

  @Column({ type: 'nvarchar', length: 255 })
  descricao: string;

  @Column({
    type: 'decimal',
    precision: 6,
    scale: 2,
    transformer: decimalParaNumero,
  })
  preco: number;

  @Column({ name: 'imagem_url', type: 'varchar', length: 255 })
  imagemUrl: string;

  @Column({ type: 'bit' })
  ativo: boolean;

  @Column({
    name: 'criado_em',
    type: 'datetime2',
    precision: 0,
    insert: false,
    update: false,
  })
  criadoEm: Date;

  @Column({
    name: 'atualizado_em',
    type: 'datetime2',
    precision: 0,
    insert: false,
    update: false,
  })
  atualizadoEm: Date;

  @ManyToMany(() => Tag)
  @JoinTable({
    name: 'cafe_tag',
    schema: 'dbo',
    joinColumn: { name: 'cafe_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: Tag[];
}
