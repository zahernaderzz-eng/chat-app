import { IsUUID } from 'class-validator';

export class MarkAsReadSocketDto {
  @IsUUID()
  conversationId: string;
}
