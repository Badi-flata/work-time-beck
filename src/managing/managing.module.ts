import { Module } from '@nestjs/common';
import { ManagingService } from './managing.service';
import { ManagingController } from './managing.controller';
import { UtilityModule } from '../utilities/utilities.module';
import { PrismaService } from '../prisma/prisma.service';
import { AttendanceModule } from '../attendance/attendance.module';

@Module({
  imports: [UtilityModule , AttendanceModule],
  controllers: [ManagingController],
  providers: [ManagingService, PrismaService],
})
export class ManagingModule {}

