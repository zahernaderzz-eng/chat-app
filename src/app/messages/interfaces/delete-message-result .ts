import { DeleteType } from '../dto/delete-message.dto';

export interface DeleteMessageResult {
  messageId: string;
  conversationId: string;
  deleteType: DeleteType;
  deletedAt: Date;
}
