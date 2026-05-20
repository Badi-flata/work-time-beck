import { Controller, Get,Query, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { ManagingService } from './managing.service';
import { UtilitiesService } from '../utilities/utilities.service';
import { ManagingDto } from './dto/managing.dto';
import { auditMyEmployeeDto } from './dto/auditMyEmployee.dto';
import { UseGuards } from '@nestjs/common';
import { AuthGuard } from '../core/guards/auth.guard';
import { RolesGuard } from '../core/guards/role.guard';
import { Roles } from '../core/decorators/role.decorator';
import { Auth } from '../core/decorators/golebl.auth.decorator';
import { Role } from '@prisma/client';
import { shift } from './dto/shfit.dto';
import { CurrentUser } from 'src/core/decorators/currntUser.decorator';

// الاسم الرئيسي للمسارات
// main path 
@Controller('managing')

//  الحراس و صلحيات الوصول
// authentication and authorization 
@Auth(Role.SUPER_ADMIN)

export class ManagingController {
  constructor(private readonly managingService: ManagingService , private readonly utility : UtilitiesService) {}
 
  // GET /managing/dashboard?date=2026-05-18
  @Get('dashboard')
  async getDashboard(
    @CurrentUser('userId') userId: string,
    @Query('date') date?: string
  ) {
    return this.utility.getDashboard(userId, date || new Date().toISOString().split('T')[0]);
  }

  // أضافة عامل لدى المدير 
  // add worker to manager
  @Post('add-employee/:id')
  addworker(@Param('id') employeeUserId: string, @CurrentUser('userId') managerUserId: string) {
    return this.managingService.addworker(employeeUserId, managerUserId);
  }

  // جلب جميع العمال لدى المدير 
  // get all employees of manager 
  @Get('my-employees')
  getMyWorkers(@CurrentUser('userId') managerUserId: string) {
    const dto = new ManagingDto();
    dto.managerId = managerUserId;
    return this.managingService.getMyWorkers(dto);
  }

  @Post('make-a-shift')
  makeAShift(@Body() shift: shift) {
    return this.managingService.newShfit(shift);
  }

  // تدقيق العامل لدى المدير 
  // audit employee to manager  
  @Patch('audit-employee')
  update(@Query() email: string, @Query() employeeId: string, @Body() audit: auditMyEmployeeDto) {
    return this.managingService.handleAndAuditMyEmployees(email, employeeId, audit);
  }

  @Delete('delete-employee/:id')
  remove(@Param('id') id: string) {
    return this.managingService.removeEmployee(id);
  }
}
