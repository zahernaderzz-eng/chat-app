// messages/messages.service.ts

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not, MoreThan } from 'typeorm';
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

  // تحديث: جلب الرسائل مع مراعاة تاريخ الحذف
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

    // الحصول على تاريخ الحذف للمستخدم
    const deletionDate = await this.conversationService.getDeletionDate(
      conversationId,
      userId,
    );

    // بناء شروط البحث
    const whereConditions: any = {
      conversationId,
      isDeleted: false,
    };

    // اذا المستخدم حذف المحادثة سابقا، نجلب الرسائل بعد تاريخ الحذف فقط
    if (deletionDate) {
      whereConditions.createdAt = MoreThan(deletionDate);
    }

    const [messages, total] = await this.messageRepo.findAndCount({
      where: whereConditions,
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

  // تحديث: عدد الرسائل غير المقروءة مع مراعاة تاريخ الحذف
  async getUnreadCount(
    conversationId: string,
    userId: string,
  ): Promise<number> {
    const deletionDate = await this.conversationService.getDeletionDate(
      conversationId,
      userId,
    );

    const whereConditions: any = {
      conversationId,
      isRead: false,
      senderId: Not(userId),
      isDeleted: false,
    };

    if (deletionDate) {
      whereConditions.createdAt = MoreThan(deletionDate);
    }

    return this.messageRepo.count({
      where: whereConditions,
    });
  }

  async getUnreadMessages(
    conversationId: string,
    userId: string,
  ): Promise<Message[]> {
    const deletionDate = await this.conversationService.getDeletionDate(
      conversationId,
      userId,
    );

    const whereConditions: any = {
      conversationId,
      isRead: false,
      senderId: Not(userId),
      isDeleted: false,
    };

    if (deletionDate) {
      whereConditions.createdAt = MoreThan(deletionDate);
    }

    return this.messageRepo.find({
      where: whereConditions,
      relations: ['sender'],
      order: { createdAt: 'ASC' },
    });
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
      .andWhere('isRead = :isRead', { isRead: false })
      .andWhere('isDeleted = :isDeleted', { isDeleted: false });

    if (deletionDate) {
      query = query.andWhere('createdAt > :deletionDate', { deletionDate });
    }

    await query.execute();
  }
}
