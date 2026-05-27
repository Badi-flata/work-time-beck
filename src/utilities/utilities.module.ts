import { Module } from '@nestjs/common';
import { UtilitiesService } from './utilities.service';
import { StatisticsHelperService } from './statistics-helper.service';
import { PrismaService } from '../prisma/prisma.service';


@Module({
  
  controllers: [],
  providers: [UtilitiesService, StatisticsHelperService, PrismaService],
  exports:  [UtilitiesService, StatisticsHelperService], 
})
export class UtilityModule {}