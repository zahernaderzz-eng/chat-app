export class SenderResponseDto {
  id: string;
  name: string;
  avatar: string | null;
}

export class ReplyToResponseDto {
  id: string;
  type: string;
  content: string;
  senderId: string;
  sender: SenderResponseDto;
  createdAt: Date;
}

export class MessageResponseDto {
  id: string;
  type: string;
  content: string;
  metadata: any;
  conversationId: string;
  senderId: string;
  sender: SenderResponseDto;
  replyToId: string | null;
  replyTo: ReplyToResponseDto | null;
  isRead: boolean;
  isDelivered: boolean;
  createdAt: Date;
}