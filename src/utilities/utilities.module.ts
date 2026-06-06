import { Module } from '@nestjs/common';
import { UtilitiesService } from './utilities.service';
import { StatisticsHelperService } from './statistics-helper.service';
import { PrismaService } from '../prisma/prisma.service';
import { CalculatePeriodService } from './caculaePeriod.service';


@Module({
  
  controllers: [],
  providers: [UtilitiesService, StatisticsHelperService, CalculatePeriodService , PrismaService],
  exports:  [UtilitiesService, StatisticsHelperService], 
})
export class UtilityModule {}