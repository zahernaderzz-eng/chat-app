import { MessageType } from '@common/enums/message-type.enum';
import { MessageMetadata } from '@common/interfaces/message-metadata.interface';

export class MessageResponseDto {
  id: string;

  conversationId: string;

  senderId: string;

  type: MessageType;

  content: string;

  metadata?: MessageMetadata;

  createdAt: Date;

  /**
   * frontend helper
   * true لو الرسالة من نفس المستخدم
   */
  isMine: boolean;
}
