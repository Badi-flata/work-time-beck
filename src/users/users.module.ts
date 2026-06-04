import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthModule } from 'src/core/auth/auth.module';
import { AuthService } from 'src/core/auth/auth.service';
import { UtilityModule } from '../utilities/utilities.module';

@Module({
  imports: [AuthModule, UtilityModule],
  controllers: [UsersController],
  providers: [UsersService, PrismaService, AuthService],
})
export class UsersModule {}
