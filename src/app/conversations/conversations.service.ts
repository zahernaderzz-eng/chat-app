import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Conversation } from './entities/conversation.entity';

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
}
