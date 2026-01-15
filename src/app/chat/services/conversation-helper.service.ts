import { Injectable } from '@nestjs/common';
import { ConversationService } from '@app/conversations/conversations.service';
import { MessagesService } from '@app/messages/messages.service';

@Injectable()
export class ConversationHelperService {
  constructor(
    private readonly conversationService: ConversationService,
    private readonly messagesService: MessagesService,
  ) {}

  async getConversationsWithUnread(userId: string) {
    const conversations =
      await this.conversationService.getUserConversations(userId);

    return Promise.all(
      conversations.map(async (conv) => {
        const unreadCount = await this.messagesService.getUnreadCount(
          conv.id,
          userId,
        );
        return {
          ...conv,
          unreadCount,
        };
      }),
    );
  }
}
