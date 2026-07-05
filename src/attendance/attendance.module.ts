import { Module } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { AttendanceController } from './attendance.controller';
import { PrismaService } from '../prisma/prisma.service';
import { UtilitiesService } from '../utilities/utilities.service';
import { UtilityModule } from '../utilities/utilities.module';

@Module({
  imports: [UtilityModule],
  controllers: [AttendanceController],
  exports: [AttendanceService],
  providers: [AttendanceService, PrismaService],
})
export class AttendanceModule {}
