import { IsUUID, IsOptional, IsInt, Min, Max } from 'class-validator';

export class GetMessagesSocketDto {
  @IsUUID()
  conversationId: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;
}
