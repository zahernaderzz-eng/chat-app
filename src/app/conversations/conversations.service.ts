import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ArrayContains, Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';
import { MessageType } from '@common/enums/message-type.enum';

@Injectable()
export class ConversationService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationRepo: Repository<Conversation>,
  ) {}

  async getOrCreateConversation(
    userId1: string,
    userId2: string,
  ): Promise<Conversation> {
    const participantIds = this.normalizeParticipants([userId1, userId2]);

    const existing = await this.conversationRepo
      .createQueryBuilder('c')
      .where('c.participantIds = :participantIds', { participantIds })
      .getOne();

    if (existing) return existing;

    const conversation = this.conversationRepo.create({ participantIds });

    try {
      return await this.conversationRepo.save(conversation);
    } catch {
      return this.conversationRepo
        .createQueryBuilder('c')
        .where('c.participantIds = :participantIds', { participantIds })
        .getOneOrFail();
    }
  }

  private normalizeParticipants(ids: string[]) {
    return [...ids].sort();
  }
  async isMember(conversationId: string, userId: string): Promise<boolean> {
    const conversation = await this.conversationRepo.findOne({
      where: { id: conversationId },
    });

    if (!conversation) return false;

    return conversation.participantIds.includes(userId);
  }

  async updateLastMessage(
    conversationId: string,
    messageData: {
      content: string;
      type: MessageType;
      senderId: string;
    },
  ): Promise<void> {
    await this.conversationRepo.update(conversationId, {
      lastMessage: messageData,
      lastMessageAt: new Date(),
    });
  }

  async findOne(id: string): Promise<Conversation> {
    const conversation = await this.conversationRepo.findOne({
      where: { id },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return conversation;
  }

  async getUserConversations(userId: string): Promise<Conversation[]> {
    return this.conversationRepo.find({
      where: {
        participantIds: ArrayContains([userId]),
      },
      order: { lastMessageAt: 'DESC' },
    });
  }
}
