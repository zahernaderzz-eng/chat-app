import { IsUUID } from 'class-validator';

export class DeleteChatSocketDto {
  @IsUUID()
  conversationId: string;
}
