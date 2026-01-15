import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Message } from './entities/message.entity';

import { ConversationService } from '@app/conversations/conversations.service';
import { MessageType } from '@common/enums/message-type.enum';
import { CreateMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    private readonly conversationService: ConversationService,
  ) {}

  async create(senderId: string, dto: CreateMessageDto): Promise<Message> {
    const conversation = await this.conversationService.findOne(
      dto.conversationId,
    );

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const isMember = await this.conversationService.isMember(
      dto.conversationId,
      senderId,
    );

    if (!isMember) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    const message = this.messageRepo.create({
      senderId,
      conversationId: dto.conversationId,
      content: dto.content,
      type: dto.type ?? MessageType.TEXT,
      metadata: dto.metadata,
    });

    const savedMessage = await this.messageRepo.save(message);

    await this.conversationService.updateLastMessage(dto.conversationId, {
      content: savedMessage.content,
      type: savedMessage.type,
      senderId: savedMessage.senderId,
    });

    return this.findOne(savedMessage.id);
  }

  async findOne(id: string): Promise<Message> {
    const message = await this.messageRepo.findOne({
      where: { id, isDeleted: false },
      relations: ['sender'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return message;
  }

  async findByConversation(
    conversationId: string,
    userId: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<{ messages: Message[]; total: number; hasMore: boolean }> {
    const isMember = await this.conversationService.isMember(
      conversationId,
      userId,
    );

    if (!isMember) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    const [messages, total] = await this.messageRepo.findAndCount({
      where: {
        conversationId,
        isDeleted: false,
      },
      relations: ['sender'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      messages: messages.reverse(),
      total,
      hasMore: page * limit < total,
    };
  }

  async getUnreadCount(
    conversationId: string,
    userId: string,
  ): Promise<number> {
    return this.messageRepo.count({
      where: {
        conversationId,
        isRead: false,
        senderId: Not(userId),
        isDeleted: false,
      },
    });
  }

  async getUnreadMessages(
    conversationId: string,
    userId: string,
  ): Promise<Message[]> {
    return this.messageRepo.find({
      where: {
        conversationId,
        isRead: false,
        senderId: Not(userId),
        isDeleted: false,
      },
      relations: ['sender'],
      order: { createdAt: 'ASC' },
    });
  }

  async markAsRead(conversationId: string, userId: string): Promise<void> {
    await this.messageRepo.update(
      {
        conversationId,
        senderId: Not(userId),
        isRead: false,
        isDeleted: false,
      },
      {
        isRead: true,
      },
    );
  }
}
