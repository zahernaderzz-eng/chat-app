import { IsUUID } from 'class-validator';

export class StartConversationSocketDto {
  @IsUUID()
  toUserId: string;
}
