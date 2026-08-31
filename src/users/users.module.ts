import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { AuthModule } from '../core/auth/auth.module';
import { AuthService } from '../core/auth/auth.service';
import { UtilityModule } from '../utilities/utilities.module';

@Module({
  imports: [AuthModule, UtilityModule],
  controllers: [UsersController],
  providers: [UsersService, AuthService],
})
export class UsersModule {}
