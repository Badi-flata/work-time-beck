import { Module } from '@nestjs/common';
import { UtilitiesService } from './utilities.service';
import { PrismaService } from '../prisma/prisma.service';


@Module({
  
  controllers: [],
  providers: [UtilitiesService, PrismaService],
  exports:  [UtilitiesService], 
})
export class UtilityModule {}