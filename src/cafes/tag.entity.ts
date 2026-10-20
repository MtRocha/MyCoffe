import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'tag', schema: 'dbo' })
export class Tag {
  @PrimaryGeneratedColumn({ type: 'tinyint' })
  id: number;

  @Column({ type: 'nvarchar', length: 30 })
  nome: string;
}
