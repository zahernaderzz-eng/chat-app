import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  Index,
  JoinColumn,
} from 'typeorm';


import { User } from '@app/users/entities/user.entity';
import { MessageType } from '@common/enums/message-type.enum';
import type { MessageMetadata } from '@common/interfaces/message-metadata.interface';
import { Conversation } from '@app/conversations/entities/conversation.entity';

@Entity()
@Index(['conversationId', 'createdAt'])
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({
    type: 'enum',
    enum: MessageType,
    default: MessageType.TEXT,
  })
  type: MessageType;

  @Column('text')
  content: string;
  @Column({ type: 'json', nullable: true })
  metadata?: MessageMetadata;

  @Column()
  conversationId: string;

  @ManyToOne(() => Conversation, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'conversationId' })
  conversation: Conversation;

  @Column()
  senderId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'senderId' })
  sender: User;

  @Column({ default: false })
  isRead: boolean;

  @Column({ default: false })
  isDelivered: boolean;

  @Column({ default: false })
  isDeleted: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
