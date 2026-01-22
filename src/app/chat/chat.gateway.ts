import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { ConversationService } from '@app/conversations/conversations.service';
import { MessagesService } from '@app/messages/messages.service';
import { MessageType } from '@common/enums/message-type.enum';
import { ChatAuthService } from './services/chat-auth.service';
import { ChatSocketService } from './services/chat-socket.service';
import { ConversationHelperService } from './services/conversation-helper.service';
import {
  DeleteMessageDto,
  DeleteType,
} from '@app/messages/dto/delete-message.dto';
import { Logger, UseGuards, ValidationPipe } from '@nestjs/common';
import { WsJwtAuthGuard } from '@app/auth/guards/ws-jwt-auth.guard';
import { DeleteChatSocketDto } from './Dtos/delete-chat-dto';

interface SendMessagePayload {
  conversationId: string;
  content: string;
  type?: MessageType;
  metadata?: Record<string, any>;
  replyToId?: string;
}

@WebSocketGateway({
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly conversationService: ConversationService,
    private readonly messagesService: MessagesService,
    private readonly chatAuthService: ChatAuthService,
    private readonly chatSocketService: ChatSocketService,
    private readonly conversationHelperService: ConversationHelperService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const userId = this.chatAuthService.verifySocketToken(client);

      client.data.userId = userId;

      this.chatSocketService.addSocket(userId, client);

      const conversations =
        await this.conversationService.getUserConversations(userId);

      this.chatSocketService.joinClientToConversations(client, conversations);

      const conversationsWithUnread =
        await this.conversationHelperService.getConversationsWithUnread(userId);

      console.log(
        `Connected: ${client.id}, userId=${userId}, rooms=${conversations.length}`,
      );

      client.emit('connected', {
        userId,
        conversations: conversationsWithUnread,
      });
    } catch (error: any) {
      console.log('Auth error:', error.message);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;

    if (userId) {
      this.chatSocketService.removeSocket(userId, client);
    }

    console.log(`Disconnected: ${client.id}, userId=${userId}`);
  }

  @SubscribeMessage('startConversation')
  async handleStartConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { toUserId: string },
  ) {
    try {
      const userId = client.data.userId;

      if (!userId) {
        client.emit('error', {
          event: 'startConversation',
          message: 'Not authenticated',
        });
        return;
      }

      const conversation =
        await this.conversationService.getOrCreateConversation(
          userId,
          body.toUserId,
        );

      client.join(conversation.id);
      console.log(`${userId} joined room ${conversation.id}`);

      this.chatSocketService.addOtherUserSocketsToConversation(
        conversation,
        body.toUserId,
        this.server,
      );

      const roomSockets = await this.server.in(conversation.id).fetchSockets();
      console.log(`Room ${conversation.id} has ${roomSockets.length} sockets`);

      client.emit('conversationStarted', conversation);
    } catch (error: any) {
      console.error('startConversation error:', error);
      client.emit('error', {
        event: 'startConversation',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessagePayload,
  ) {
    try {
      const userId = client.data.userId;

      if (!userId) {
        client.emit('error', {
          event: 'sendMessage',
          message: 'Not authenticated',
        });
        return;
      }

      if (!payload.conversationId || !payload.content?.trim()) {
        client.emit('error', {
          event: 'sendMessage',
          message: 'conversationId and content required',
        });
        return;
      }

      const message = await this.messagesService.create(userId, {
        conversationId: payload.conversationId,
        content: payload.content,
        type: payload.type ?? MessageType.TEXT,
        metadata: payload.metadata,
        replyToId: payload.replyToId,
      });

      this.server.to(payload.conversationId).emit('newMessage', message);
      console.log(`Message sent in ${payload.conversationId}`);
    } catch (error) {
      console.error('sendMessage error:', error);
      client.emit('error', {
        event: 'sendMessage',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('getMessages')
  async handleGetMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      conversationId: string;
      page?: number;
      limit?: number;
    },
  ) {
    try {
      const userId = client.data.userId;

      if (!userId) {
        client.emit('error', {
          event: 'getMessages',
          message: 'Not authenticated',
        });
        return;
      }

      if (!data.conversationId) {
        client.emit('error', {
          event: 'getMessages',
          message: 'conversationId required',
        });
        return;
      }

      const result = await this.messagesService.findByConversation(
        data.conversationId,
        userId,
        data.page ?? 1,
        data.limit ?? 50,
      );

      client.emit('messagesLoaded', {
        conversationId: data.conversationId,
        ...result,
      });
    } catch (error: any) {
      client.emit('error', {
        event: 'getMessages',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { conversationId: string },
  ) {
    try {
      const userId = client.data.userId;

      if (!userId) {
        client.emit('error', {
          event: 'markAsRead',
          message: 'Not authenticated',
        });
        return;
      }

      if (!data.conversationId) {
        client.emit('error', {
          event: 'markAsRead',
          message: 'conversationId required',
        });
        return;
      }

      await this.messagesService.markAsRead(data.conversationId, userId);

      client.to(data.conversationId).emit('messagesRead', {
        conversationId: data.conversationId,
        readBy: userId,
        readAt: new Date(),
      });

      console.log(
        `Messages marked as read in ${data.conversationId} by ${userId}`,
      );
    } catch (error: any) {
      client.emit('error', {
        event: 'markAsRead',
        message: error.message,
      });
    }
  }

  @SubscribeMessage('getConversations')
  async handleGetConversations(@ConnectedSocket() client: Socket) {
    try {
      const userId = client.data.userId;

      if (!userId) {
        client.emit('error', {
          event: 'getConversations',
          message: 'Not authenticated',
        });
        return;
      }

      const conversations =
        await this.conversationService.getUserConversations(userId);

      const conversationsWithUnread =
        await this.conversationHelperService.getConversationsWithUnread(userId);

      client.emit('conversationsLoaded', conversationsWithUnread);
    } catch (error: any) {
      client.emit('error', {
        event: 'getConversations',
        message: error.message,
      });
    }
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage('deleteChat')
  async handleDeleteChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: DeleteChatSocketDto,
  ) {
    try {
      const userId = client.data.userId;

      await this.conversationService.deleteForUser(data.conversationId, userId);

      client.emit('chatDeleted', {
        conversationId: data.conversationId,
        deletedAt: new Date(),
      });

      this.logger.log(`Chat ${data.conversationId} deleted for user ${userId}`);
    } catch (error) {
      this.emitError(client, 'deleteChat', error);
    }
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody(new ValidationPipe({ transform: true }))
    data: DeleteMessageDto,
  ) {
    try {
      const userId = client.data.userId;

      const result = await this.messagesService.deleteMessage(
        data.messageId,
        userId,
        data.deleteType,
      );

      if (data.deleteType === DeleteType.FOR_ALL) {
        this.server.to(result.conversationId).emit('messageDeletedForAll', {
          messageId: result.messageId,
          conversationId: result.conversationId,
        });
      } else {
        client.emit('messageDeletedForMe', {
          messageId: result.messageId,
          conversationId: result.conversationId,
        });
      }

      this.logger.log(
        `Message ${data.messageId} deleted (${data.deleteType}) by ${userId}`,
      );
    } catch (error) {
      this.logger.error('Delete message error:', error);
      this.emitError(client, 'deleteMessage', error);
    }
  }

  private emitError(client: Socket, action: string, error: any) {
    client.emit('socketError', {
      action,
      message: error?.message ?? 'Unexpected error',
    });
  }
}
