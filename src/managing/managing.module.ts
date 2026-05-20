import { Module } from '@nestjs/common';
import { ManagingService } from './managing.service';
import { ManagingController } from './managing.controller';
import { UtilitiesService } from '../utilities/utilities.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  controllers: [ManagingController],
  providers: [ManagingService, UtilitiesService, PrismaService],
})
export class ManagingModule {}
