import { Entity, Column } from 'typeorm';
import { Exclude } from 'class-transformer';
import { BaseEntity } from '@common/entities/base.entity';

@Entity('users')
export class User extends BaseEntity {
  @Column({ length: 100, unique: true })
  name: string;

  @Column({ unique: true })
  email: string;

  @Column({ unique: true })
  phone: string;

  @Column({ nullable: true })
  avatar: string;

  @Column({ nullable: true })
  lastSeen: Date;

  @Column()
  @Exclude()
  password: string;
}
