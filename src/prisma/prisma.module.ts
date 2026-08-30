import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * PrismaModule — وحدة عامة (Global) لتوفير PrismaService
 * بدلاً من تسجيل PrismaService في providers لكل Module على حدة
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
