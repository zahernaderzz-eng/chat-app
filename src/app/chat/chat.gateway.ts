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
import { JwtService } from '@nestjs/jwt';
import { ConversationService } from '@app/conversations/conversations.service';
import { MessagesService } from '@app/messages/messages.service';
import { MessageType } from '@common/enums/message-type.enum';

interface SendMessagePayload {
  conversationId: string;
  content: string;
  type?: MessageType;
  metadata?: Record<string, any>;
}

@WebSocketGateway({
  cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly conversationService: ConversationService,
    private readonly messagesService: MessagesService,
    private readonly jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const payload = this.jwtService.verify(token);
      const userId = payload.sub || payload.userId;

      if (!userId) {
        client.emit('error', { message: 'Invalid token' });
        client.disconnect();
        return;
      }

      client.data.userId = userId;

      const set = this.userSockets.get(userId) ?? new Set<string>();
      set.add(client.id);
      this.userSockets.set(userId, set);

      const conversations =
        await this.conversationService.getUserConversations(userId);

      conversations.forEach((conv) => {
        client.join(conv.id);
      });

      const conversationsWithUnread = await Promise.all(
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

      console.log(
        `Connected: ${client.id}, userId=${userId}, rooms=${conversations.length}`,
      );

      client.emit('connected', {
        userId,
        conversations: conversationsWithUnread,
      });
    } catch (error) {
      console.log('Auth error:', error.message);
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;

    if (userId) {
      const set = this.userSockets.get(userId);
      if (set) {
        set.delete(client.id);
        if (set.size === 0) {
          this.userSockets.delete(userId);
        }
      }
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

      const otherUserSockets = this.userSockets.get(body.toUserId);
      console.log(
        `Looking for ${body.toUserId}: ${otherUserSockets?.size ?? 0} sockets`,
      );

      if (otherUserSockets && otherUserSockets.size > 0) {
        for (const socketId of otherUserSockets) {
          const otherSocket = this.server.sockets.sockets.get(socketId);
          if (otherSocket) {
            otherSocket.join(conversation.id);
            otherSocket.emit('newConversation', conversation);
            console.log(`${body.toUserId} joined room ${conversation.id}`);
          }
        }
      }

      const roomSockets = await this.server.in(conversation.id).fetchSockets();
      console.log(`Room ${conversation.id} has ${roomSockets.length} sockets`);

      client.emit('conversationStarted', conversation);
    } catch (error) {
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
    } catch (error) {
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
    } catch (error) {
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

      const conversationsWithUnread = await Promise.all(
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

      client.emit('conversationsLoaded', conversationsWithUnread);
    } catch (error) {
      client.emit('error', {
        event: 'getConversations',
        message: error.message,
      });
    }
  }
}
