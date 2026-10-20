import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'forma_pagamento', schema: 'dbo' })
export class FormaPagamento {
  @PrimaryGeneratedColumn({ type: 'tinyint' })
  id: number;

  @Column({ type: 'varchar', length: 20 })
  codigo: string;

  @Column({ type: 'nvarchar', length: 30 })
  descricao: string;

  @Column({ type: 'bit' })
  ativo: boolean;
}
