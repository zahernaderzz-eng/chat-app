import { Injectable } from '@nestjs/common';
import { Server, Socket } from 'socket.io';

@Injectable()
export class ChatSocketService {
  private userSockets = new Map<string, Set<string>>();

  addSocket(userId: string, client: Socket) {
    const set = this.userSockets.get(userId) ?? new Set<string>();
    set.add(client.id);
    this.userSockets.set(userId, set);
  }

  removeSocket(userId: string, client: Socket) {
    const set = this.userSockets.get(userId);
    if (!set) return;
    set.delete(client.id);
    if (set.size === 0) {
      this.userSockets.delete(userId);
    } else {
      this.userSockets.set(userId, set);
    }
  }

  getUserSocketIds(userId: string): Set<string> | undefined {
    return this.userSockets.get(userId);
  }

  joinClientToConversations(
    client: Socket,
    conversations: Array<{ id: string }>,
  ) {
    conversations.forEach((conv) => {
      client.join(conv.id);
    });
  }

  addOtherUserSocketsToConversation(
    conversation: { id: string },
    toUserId: string,
    server: Server,
  ) {
    const otherUserSockets = this.userSockets.get(toUserId);
    console.log(
      `Looking for ${toUserId}: ${otherUserSockets?.size ?? 0} sockets`,
    );

    if (otherUserSockets && otherUserSockets.size > 0) {
      for (const socketId of otherUserSockets) {
        const otherSocket = server.sockets.sockets.get(socketId);
        if (otherSocket) {
          otherSocket.join(conversation.id);
          otherSocket.emit('newConversation', conversation);
          console.log(`${toUserId} joined room ${conversation.id}`);
        }
      }
    }
  }
}
