import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Message } from '../entities/message.entity';
import { MessageDeletion } from '../entities/message-deletion.entity';

import { DeleteType } from '../dto/delete-message.dto';
import { ConversationService } from '@app/conversations/conversations.service';
import { UploadsService } from '@app/uploads/uploads.service';
import { MessageType } from '@common/enums/message-type.enum';
import { DeleteMessageResult } from '../interfaces/delete-message-result ';

@Injectable()
export class DeleteMessageService {
  constructor(
    @InjectRepository(Message)
    private readonly messageRepo: Repository<Message>,
    @InjectRepository(MessageDeletion)
    private readonly messageDeletionRepo: Repository<MessageDeletion>,
    private readonly conversationService: ConversationService,
    private readonly uploadsService: UploadsService,
  ) {}

  async deleteMessage(
    messageId: string,
    userId: string,
    deleteType: DeleteType,
  ): Promise<DeleteMessageResult> {
    return this.messageRepo.manager.transaction(async (manager) => {
      const message = await manager.findOne(Message, {
        where: { id: messageId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!message) {
        throw new NotFoundException('Message not found');
      }

      const isMember = await this.conversationService.isMember(
        message.conversationId,
        userId,
      );

      if (!isMember) {
        throw new ForbiddenException(
          'You are not a member of this conversation',
        );
      }

      if (deleteType === DeleteType.FOR_ALL) {
        return this.deleteForAll(message, userId, manager);
      }

      return this.deleteForMe(message, userId, manager);
    });
  }

  private async deleteForMe(
    message: Message,
    userId: string,
    manager: EntityManager,
  ): Promise<DeleteMessageResult> {
    const messageDeletionRepo = manager.getRepository(MessageDeletion);

    const existingDeletion = await messageDeletionRepo.findOne({
      where: { messageId: message.id, userId },
    });

    if (!existingDeletion) {
      const deletion = messageDeletionRepo.create({
        messageId: message.id,
        userId,
      });
      await messageDeletionRepo.save(deletion);
    }

    return {
      messageId: message.id,
      conversationId: message.conversationId,
      deleteType: DeleteType.FOR_ME,
      deletedAt: new Date(),
    };
  }

  private async deleteForAll(
    message: Message,
    userId: string,
    manager: EntityManager,
  ): Promise<DeleteMessageResult> {
    if (message.senderId !== userId) {
      throw new ForbiddenException(
        'You can only delete your own messages for everyone',
      );
    }

    const messageId = message.id;
    const conversationId = message.conversationId;

    if (message.type !== MessageType.TEXT && message.content) {
      try {
        await this.uploadsService.deleteFile(message.content);
        if (message.metadata?.thumbnail) {
          await this.uploadsService.deleteFile(message.metadata.thumbnail);
        }
      } catch (err) {
        console.error('File delete failed', err);
      }
    }

    const messageRepo = manager.getRepository(Message);
    const messageDeletionRepo = manager.getRepository(MessageDeletion);

    await messageDeletionRepo.delete({ messageId });
    await messageRepo.remove(message);

    return {
      messageId,
      conversationId,
      deleteType: DeleteType.FOR_ALL,
      deletedAt: new Date(),
    };
  }
}
