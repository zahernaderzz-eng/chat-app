import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ArrayContains } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationDeletion } from './entities/conversation-deletion.entity';
import { MessageType } from '@common/enums/message-type.enum';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
    @InjectRepository(ConversationDeletion)
    private readonly deletionRepo: Repository<ConversationDeletion>,
  ) {}

  async findOne(id: string): Promise<Conversation> {
    const conversation = await this.conversationRepo.findOne({
      where: { id },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  async isMember(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });

    if (!conversation) return false;

    return conversation.participantIds.includes(userId);
  }

  async getOrCreateConversation(
    userId: string,
    toUserId: string,
  ): Promise<Conversation> {
    const existingConversation = await this.conversationRepo.findOne({
      where: [
        { participantIds: ArrayContains([userId, toUserId]) },
      ],
    });

    if (existingConversation) {
      return existingConversation;
    }

    const conversation = this.conversationRepo.create({
      participantIds: [userId, toUserId],
    });

    return this.conversationRepo.save(conversation);
  }

  async getUserConversations(userId: string): Promise<Conversation[]> {
    return this.conversationRepo.find({
      where: {
        participantIds: ArrayContains([userId]),
      },
      order: { lastMessageAt: 'DESC' },
    });
  }

  async updateLastMessage(
    conversationId: string,
    messageData: {
      content: string;
      type: MessageType;
      senderId: string;
    },
  ): Promise<void> {
    const truncatedContent =
      messageData.content.length > 100
        ? messageData.content.substring(0, 100) + '...'
        : messageData.content;

    await this.conversationRepo.update(conversationId, {
      lastMessage: {
        ...messageData,
        content: truncatedContent,
      },
      lastMessageAt: new Date(),
    });
  }

  async deleteForUser(conversationId: string, userId: string): Promise<void> {
    const conversation = await this.findOne(conversationId);

    const isMember = conversation.participantIds.includes(userId);
    if (!isMember) {
      throw new NotFoundException('Conversation not found');
    }

    const existingDeletion = await this.deletionRepo.findOne({
      where: { conversationId, userId },
    });

    if (existingDeletion) {
      existingDeletion.deletedAt = new Date();
      await this.deletionRepo.save(existingDeletion);
    } else {
      const deletion = this.deletionRepo.create({
        conversationId,
        userId,
        deletedAt: new Date(),
      });
      await this.deletionRepo.save(deletion);
    }
  }


  async getDeletionDate(
    conversationId: string,
    userId: string,
  ): Promise<Date | null> {
    const deletion = await this.deletionRepo.findOne({
      where: { conversationId, userId },
    });

    return deletion?.deletedAt || null;
  }
}