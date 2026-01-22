// messages/messages.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Message } from './entities/message.entity';
import { MessageDeletion } from './entities/message-deletion.entity';

import { DeleteType } from './dto/delete-message.dto';

import { ConversationService } from '@app/conversations/conversations.service';
import { MessageType } from '@common/enums/message-type.enum';
import {
  transformMessage,
  transformMessages,
} from './helpers/message.transformer';
import { CreateMessageDto } from './dto/send-message.dto';
import { DeleteMessageResult } from './interfaces/delete-message-result ';
import { DeleteMessageService } from './services/delete-message.service';


@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(MessageDeletion)
    private readonly messageDeletionRepo: Repository<MessageDeletion>,
    private readonly conversationService: ConversationService,
    private readonly deleteMessageService: DeleteMessageService,
  ) {}

  async create(senderId: string, dto: CreateMessageDto) {
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

    if (dto.replyToId) {
      const replyToMessage = await this.messageRepo.findOne({
        where: {
          id: dto.replyToId,
          conversationId: dto.conversationId,
        },
      });

      if (!replyToMessage) {
        throw new BadRequestException('Reply message not found');
      }
    }

    const message = new Message();
    message.senderId = senderId;
    message.conversationId = dto.conversationId;
    message.content = dto.content;
    message.type = dto.type ?? MessageType.TEXT;
    message.metadata = dto.metadata;

    if (dto.replyToId) {
      message.replyToId = dto.replyToId;
    }

    const savedMessage = await this.messageRepo.save(message);

    await this.conversationService.updateLastMessage(dto.conversationId, {
      content: savedMessage.content,
      type: savedMessage.type,
      senderId: savedMessage.senderId,
    });

    const fullMessage = await this.findOneRaw(savedMessage.id);

    return transformMessage(fullMessage);
  }

  private async findOneRaw(id: string): Promise<Message> {
    const message = await this.messageRepo.findOne({
      where: { id },
      relations: ['sender', 'replyTo', 'replyTo.sender'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    return message;
  }

  async findOne(id: string) {
    const message = await this.findOneRaw(id);
    return transformMessage(message);
  }

  private async getDeletedMessageIds(userId: string): Promise<string[]> {
    const deletions = await this.messageDeletionRepo.find({
      where: { userId },
      select: ['messageId'],
    });

    return deletions.map((d) => d.messageId);
  }

  async findByConversation(
    conversationId: string,
    userId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    const isMember = await this.conversationService.isMember(
      conversationId,
      userId,
    );

    if (!isMember) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    const deletionDate = await this.conversationService.getDeletionDate(
      conversationId,
      userId,
    );

    const deletedMessageIds = await this.getDeletedMessageIds(userId);

    const queryBuilder = this.messageRepo
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.sender', 'sender')
      .leftJoinAndSelect('message.replyTo', 'replyTo')
      .leftJoinAndSelect('replyTo.sender', 'replyToSender')
      .where('message.conversationId = :conversationId', { conversationId });

    if (deletedMessageIds.length > 0) {
      queryBuilder.andWhere('message.id NOT IN (:...deletedMessageIds)', {
        deletedMessageIds,
      });
    }

    if (deletionDate) {
      queryBuilder.andWhere('message.createdAt > :deletionDate', {
        deletionDate,
      });
    }

    const [messages, total] = await queryBuilder
      .orderBy('message.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      messages: transformMessages(messages.reverse()),
      total,
      hasMore: page * limit < total,
    };
  }

  async getUnreadCount(
    conversationId: string,
    userId: string,
  ): Promise<number> {
    const deletionDate = await this.conversationService.getDeletionDate(
      conversationId,
      userId,
    );

    const deletedMessageIds = await this.getDeletedMessageIds(userId);

    const queryBuilder = this.messageRepo
      .createQueryBuilder('message')
      .where('message.conversationId = :conversationId', { conversationId })
      .andWhere('message.isRead = :isRead', { isRead: false })
      .andWhere('message.senderId != :userId', { userId });

    if (deletedMessageIds.length > 0) {
      queryBuilder.andWhere('message.id NOT IN (:...deletedMessageIds)', {
        deletedMessageIds,
      });
    }

    if (deletionDate) {
      queryBuilder.andWhere('message.createdAt > :deletionDate', {
        deletionDate,
      });
    }

    return queryBuilder.getCount();
  }

  async markAsRead(conversationId: string, userId: string): Promise<void> {
    const deletionDate = await this.conversationService.getDeletionDate(
      conversationId,
      userId,
    );

    let query = this.messageRepo
      .createQueryBuilder()
      .update(Message)
      .set({ isRead: true })
      .where('conversationId = :conversationId', { conversationId })
      .andWhere('senderId != :userId', { userId }) ////
      .andWhere('isRead = :isRead', { isRead: false });

    if (deletionDate) {
      query = query.andWhere('createdAt > :deletionDate', { deletionDate });
    }

    await query.execute();
  }

  async deleteMessage(
    messageId: string,
    userId: string,
    deleteType: DeleteType,
  ): Promise<DeleteMessageResult> {
    return this.deleteMessageService.deleteMessage(
      messageId,
      userId,
      deleteType,
    );
  }
}
