import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { CoreConfigModule } from '@core/config/config.module';
import { DatabaseModule } from '@core/database/database.module';
import { CoreThrottlerModule } from '@core/throttler/throttler.module';
import { CoreJwtModule } from '@core/jwt/jwt.module';
import { UsersModule } from '@app/users/users.module';
import { AuthModule } from '@app/auth/auth.module';
import { JwtAuthGuard } from '@app/auth/guards/jwt-auth.guard';
import { ChatModule } from '@app/chat/chat.module';
import { ConversationModule } from '@app/conversations/conversations.module';
import { MessageModule } from '@app/messages/messages.module';
import { UploadsModule } from './app/uploads/uploads.module';

@Module({
  imports: [
    CoreConfigModule,
    DatabaseModule,
    CoreThrottlerModule,
    CoreJwtModule,
    UsersModule,
    AuthModule,
    ChatModule,
    ConversationModule,
    MessageModule,
    UploadsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
