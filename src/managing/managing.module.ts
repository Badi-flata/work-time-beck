import { Module } from '@nestjs/common';
import { ManagingService } from './managing.service';
import { ManagingController } from './managing.controller';
import { UtilityModule } from '../utilities/utilities.module';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  imports: [UtilityModule],
  controllers: [ManagingController],
  providers: [ManagingService, PrismaService],
})
export class ManagingModule {}

