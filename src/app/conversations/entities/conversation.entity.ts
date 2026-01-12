import {
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  Column,
  Index,
} from 'typeorm';

import { MessageType } from '@common/enums/message-type.enum';
import { Message } from '@app/messages/entities/message.entity';

@Entity()
@Index(['participantIds'], { unique: true })
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid', { array: true })
  participantIds: string[];

  @OneToMany(() => Message, (message) => message.conversation)
  messages: Message[];

  @Column({ type: 'json', nullable: true })
  lastMessage?: {
    content: string;
    type: MessageType;
    senderId: string;
  };

  @Column({ nullable: true })
  lastMessageAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
