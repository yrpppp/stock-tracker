import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class Stock {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  symbol: string;

  @Column('decimal', { precision: 10, scale: 2 })
  purchasePrice: number;

  @Column('int', { default: 1 })
  quantity: number;

  @Column({ default: 'default_user' })
  userId: string;

  @CreateDateColumn()
  createdAt: Date;
}
