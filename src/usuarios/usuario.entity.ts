import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export const PAPEIS = ['CLIENTE', 'FUNCIONARIO', 'ADMIN'] as const;
export type Papel = (typeof PAPEIS)[number];

@Entity({ name: 'usuario', schema: 'dbo' })
export class Usuario {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @Column({ type: 'nvarchar', length: 100 })
  nome: string;

  @Column({ type: 'varchar', length: 254 })
  email: string;

  @Column({ name: 'senha_hash', type: 'varchar', length: 255, select: false })
  senhaHash: string;

  @Column({ type: 'varchar', length: 11, nullable: true })
  telefone: string | null;

  @Column({ type: 'varchar', length: 12 })
  papel: Papel;

  @Column({ type: 'bit' })
  ativo: boolean;

  @Column({
    name: 'ultimo_login_em',
    type: 'datetime2',
    precision: 0,
    nullable: true,
  })
  ultimoLoginEm: Date | null;

  // Preenchidas por DEFAULT e pelas triggers de auditoria
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
}
