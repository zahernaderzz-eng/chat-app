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
import { MarkAsReadSocketDto } from './Dtos/mark-as-read-dto';
import { GetMessagesSocketDto } from './Dtos/get-message-dto';
import { SendMessageSocketDto } from './Dtos/send-message-dto';
import { StartConversationSocketDto } from './Dtos/start-conversation-dto';

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

      const conversations = await this.initializeUserSocket(client, userId);

      this.logger.log(`Connected: ${client.id}, userId=${userId}`);

      client.emit('connected', {
        userId,
        conversations,
      });
    } catch (error) {
      this.logger.warn(`Socket auth failed for ${client.id}`);

      client.emit('socketError', {
        action: 'connect',
        message: 'Authentication failed',
      });

      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data?.userId;

    if (userId) {
      this.chatSocketService.removeSocket(userId, client);
    }

    this.logger.log(`Disconnected: ${client.id}, userId=${userId}`);
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage('startConversation')
  async handleStartConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    data: StartConversationSocketDto,
  ) {
    try {
      const userId = client.data.userId;

      const conversation =
        await this.conversationService.getOrCreateConversation(
          userId,
          data.toUserId,
        );

      client.join(conversation.id);

      this.chatSocketService.addOtherUserSocketsToConversation(
        conversation,
        data.toUserId,
        this.server,
      );

      this.logger.log(`User ${userId} joined conversation ${conversation.id}`);

      client.emit('conversationStarted', conversation);
    } catch (error) {
      this.emitError(client, 'startConversation', error);
    }
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    data: SendMessageSocketDto,
  ) {
    try {
      const userId = client.data.userId;

      const message = await this.messagesService.create(userId, {
        conversationId: data.conversationId,
        content: data.content,
        type: data.type ?? MessageType.TEXT,
        metadata: data.metadata,
        replyToId: data.replyToId,
      });

      this.server.to(data.conversationId).emit('newMessage', message);

      this.logger.log(`Message sent in ${data.conversationId} by ${userId}`);
    } catch (error) {
      this.emitError(client, 'sendMessage', error);
    }
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage('getMessages')
  async handleGetMessages(
    @ConnectedSocket() client: Socket,
    @MessageBody(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    data: GetMessagesSocketDto,
  ) {
    try {
      const userId = client.data.userId;

      const result = await this.messagesService.findByConversation(
        data.conversationId,
        userId,
        data.page,
        data.limit,
      );

      client.emit('messagesLoaded', {
        conversationId: data.conversationId,
        ...result,
      });

      this.logger.log(
        `Messages loaded for conversation ${data.conversationId} by ${userId}`,
      );
    } catch (error) {
      this.emitError(client, 'getMessages', error);
    }
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage('markAsRead')
  async handleMarkAsRead(
    @ConnectedSocket() client: Socket,
    @MessageBody(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    data: MarkAsReadSocketDto,
  ) {
    try {
      const userId = client.data.userId;

      await this.messagesService.markAsRead(data.conversationId, userId);

      client.to(data.conversationId).emit('messagesRead', {
        conversationId: data.conversationId,
        readBy: userId,
        readAt: new Date(),
      });

      this.logger.log(
        `Messages marked as read in ${data.conversationId} by ${userId}`,
      );
    } catch (error) {
      this.emitError(client, 'markAsRead', error);
    }
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage('getConversations')
  async handleGetConversations(@ConnectedSocket() client: Socket) {
    try {
      const userId = client.data.userId;

      const conversations =
        await this.conversationHelperService.getConversationsWithUnread(userId);

      client.emit('conversationsLoaded', conversations);

      this.logger.log(`Conversations loaded for user ${userId}`);
    } catch (error) {
      this.emitError(client, 'getConversations', error);
    }
  }

  @UseGuards(WsJwtAuthGuard)
  @SubscribeMessage('deleteChat')
  async handleDeleteChat(
    @ConnectedSocket() client: Socket,
    @MessageBody(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
    data: DeleteChatSocketDto,
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
    @MessageBody(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    )
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

  private async initializeUserSocket(client: Socket, userId: string) {
    this.chatSocketService.addSocket(userId, client);

    const conversations =
      await this.conversationService.getUserConversations(userId);

    this.chatSocketService.joinClientToConversations(client, conversations);

    return this.conversationHelperService.getConversationsWithUnread(userId);
  }
}
