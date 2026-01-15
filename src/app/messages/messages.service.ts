// messages/messages.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, MoreThan, In } from 'typeorm';
import { Message } from './entities/message.entity';
import { MessageDeletion } from './entities/message-deletion.entity';

import { DeleteType } from './dto/delete-message.dto';
import { ConversationService } from '@app/conversations/conversations.service';
import { UploadsService } from '@app/uploads/uploads.service';
import { MessageType } from '@common/enums/message-type.enum';
import {
  transformMessage,
  transformMessages,
} from './helpers/message.transformer';
import { CreateMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(MessageDeletion)
    private readonly messageDeletionRepo: Repository<MessageDeletion>,
    private readonly conversationService: ConversationService,
    private readonly uploadsService: UploadsService,
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

  // حذف الرسالة
  async deleteMessage(
    messageId: string,
    userId: string,
    deleteType: DeleteType,
  ) {
    const message = await this.messageRepo.findOne({
      where: { id: messageId },
      relations: ['sender'],
    });

    if (!message) {
      throw new NotFoundException('Message not found');
    }

    const isMember = await this.conversationService.isMember(
      message.conversationId,
      userId,
    );

    if (!isMember) {
      throw new ForbiddenException('You are not a member of this conversation');
    }

    if (deleteType === DeleteType.FOR_ALL) {
      // حذف للجميع - فقط صاحب الرسالة يقدر
      if (message.senderId !== userId) {
        throw new ForbiddenException(
          'You can only delete your own messages for everyone',
        );
      }

      // حذف الملف من السيرفر لو مش نص
      if (message.type !== MessageType.TEXT && message.content) {
        await this.uploadsService.deleteFile(message.content);

        // حذف الـ thumbnail لو موجود
        if (message.metadata?.thumbnail) {
          await this.uploadsService.deleteFile(message.metadata.thumbnail);
        }
      }

      // حذف الرسالة من Database نهائيا
      const conversationId = message.conversationId;
      await this.messageRepo.remove(message);

      // حذف اي سجلات حذف مرتبطة بهذه الرسالة
      await this.messageDeletionRepo.delete({ messageId });

      return {
        messageId,
        conversationId,
        deleteType: DeleteType.FOR_ALL,
        deletedAt: new Date(),
      };
    } else {
      // حذف لي فقط
      const existingDeletion = await this.messageDeletionRepo.findOne({
        where: { messageId, userId },
      });

      if (!existingDeletion) {
        const deletion = this.messageDeletionRepo.create({
          messageId,
          userId,
        });
        await this.messageDeletionRepo.save(deletion);
      }

      return {
        messageId: message.id,
        conversationId: message.conversationId,
        deleteType: DeleteType.FOR_ME,
        deletedAt: new Date(),
      };
    }
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
      .andWhere('senderId != :userId', { userId })
      .andWhere('isRead = :isRead', { isRead: false });

    if (deletionDate) {
      query = query.andWhere('createdAt > :deletionDate', { deletionDate });
    }

    await query.execute();
  }
}
