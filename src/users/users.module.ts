import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthModule } from 'src/core/auth/auth.module';
import{AuthService} from 'src/core/auth/auth.service';
import { UtilitiesService } from '../utilities/utilities.service';

@Module({
  imports:[AuthModule],
  controllers: [UsersController],
  providers: [UsersService , PrismaService, AuthService,UtilitiesService],
})
export class UsersModule {}
