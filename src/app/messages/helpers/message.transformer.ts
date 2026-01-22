import { Message } from '../entities/message.entity';
{
}
export function transformSender(user: any) {
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    avatar: user.avatar || null,
  };
}

export function transformReplyTo(message: Message | null | undefined) {
  if (!message) return null;

  return {
    id: message.id,
    type: message.type,
    content: message.content,
    senderId: message.senderId,
    sender: transformSender(message.sender),
    createdAt: message.createdAt,
  };
}

export function transformMessage(message: Message) {
  return {
    id: message.id,
    type: message.type,
    content: message.content,
    metadata: message.metadata || null,
    conversationId: message.conversationId,
    senderId: message.senderId,
    sender: transformSender(message.sender),
    replyToId: message.replyToId || null,
    replyTo: transformReplyTo(message.replyTo),
    isRead: message.isRead,
    isDelivered: message.isDelivered,
    createdAt: message.createdAt,
  };
}

export function transformMessages(messages: Message[]) {
  return messages.map(transformMessage);
}
