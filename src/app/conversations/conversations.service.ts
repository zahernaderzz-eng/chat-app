import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ArrayContains } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { ConversationDeletion } from './entities/conversation-deletion.entity';
import { MessageType } from '@common/enums/message-type.enum';

interface LastMessageData {
  content: string;
  type: MessageType;
  senderId: string;
}

@Injectable()
export class ConversationService {
  private static readonly MAX_PREVIEW_LENGTH = 100;
  private static readonly PREVIEW_ELLIPSIS = '...';

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

    if (!conversation) {
      return false;
    }

    return conversation.participantIds.includes(userId);
  }

  async getOrCreateConversation(
    userId: string,
    toUserId: string,
  ): Promise<Conversation> {
    const existingConversation = await this.findExistingConversation(
      userId,
      toUserId,
    );

    if (existingConversation) {
      return existingConversation;
    }

    return this.createConversation([userId, toUserId]);
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
    messageData: LastMessageData,
  ): Promise<void> {
    await this.conversationRepo.update(conversationId, {
      lastMessage: {
        ...messageData,
        content: this.truncateContent(messageData.content),
      },
      lastMessageAt: new Date(),
    });
  }

  async deleteForUser(conversationId: string, userId: string): Promise<void> {
    await this.validateUserMembership(conversationId, userId);
    await this.upsertDeletion(conversationId, userId);
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

  // Private helper methods

  private async findExistingConversation(
    userId: string,
    toUserId: string,
  ): Promise<Conversation | null> {
    return this.conversationRepo.findOne({
      where: {
        participantIds: ArrayContains([userId, toUserId]),
      },
    });
  }

  private async createConversation(
    participantIds: string[],
  ): Promise<Conversation> {
    const conversation = this.conversationRepo.create({ participantIds });
    return this.conversationRepo.save(conversation);
  }

  private truncateContent(content: string): string {
    if (content.length <= ConversationService.MAX_PREVIEW_LENGTH) {
      return content;
    }

    return (
      content.substring(0, ConversationService.MAX_PREVIEW_LENGTH) +
      ConversationService.PREVIEW_ELLIPSIS
    );
  }

  private async validateUserMembership(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const conversation = await this.findOne(conversationId);

    if (!conversation.participantIds.includes(userId)) {
      throw new NotFoundException('Conversation not found');
    }
  }

  private async upsertDeletion(
    conversationId: string,
    userId: string,
  ): Promise<void> {
    const existingDeletion = await this.deletionRepo.findOne({
      where: { conversationId, userId },
    });

    const deletedAt = new Date();

    if (existingDeletion) {
      existingDeletion.deletedAt = deletedAt;
      await this.deletionRepo.save(existingDeletion);
    } else {
      const deletion = this.deletionRepo.create({
        conversationId,
        userId,
        deletedAt,
      });
      await this.deletionRepo.save(deletion);
    }
  }
}
