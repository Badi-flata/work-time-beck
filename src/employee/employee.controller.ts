import { Controller, Get, Post, Body, Patch, Delete, Query, BadRequestException } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmployeeDto } from './dto/employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CurrentUser } from '../core/decorators/currntUser.decorator';
import { Auth } from '../core/decorators/golebl.auth.decorator';
import { Role } from '@prisma/client';
import { UtilitiesService } from 'src/utilities/utilities.service';
import { Modes } from '../utilities/types/dashboard-registry.types';

@Auth(Role.EMPLOYEE, Role.SUPER_ADMIN)
@Controller('employee')
export class EmployeeController {
  constructor(
    private readonly employeeService: EmployeeService,
    private readonly utility: UtilitiesService
  ) {}

  @Get('profile')
  getMyProfile(@CurrentUser('userId') userId: string) {
    return this.employeeService.getMyProfile(userId);
  }

  @Post('set-manager')
  addOrChangeManager(@Body() employeeDto: EmployeeDto, @CurrentUser('userId') userId: string) {
    if (!employeeDto.managerId) {
      throw new BadRequestException('معرف المدير مطلوب / managerId is required');
    }
    return this.employeeService.addOrChangeManager(employeeDto.managerId, userId);
  }
 

  @Patch('update-profile')
  update(@CurrentUser('userId') userId: string, @Body() updateEmployeeDto: UpdateEmployeeDto) {
    return this.employeeService.update(userId, updateEmployeeDto);
  }

 

  @Get('today-status')
  getTodayStatus(@CurrentUser('userId') userId: string) {
    return this.utility.getTodayAttendanceStatus(userId);
  }

  @Get('my-dashboard')
  getMyDashboard(@CurrentUser('userId') userId: string) {
    return this.employeeService.getMyDashboard(userId);
  }

  @Get('discipline-rate')
  getMyDisciplineRate(
    @CurrentUser('userId') userId: string,
    @Query('days') days?: string,
  ) {
    return this.employeeService.getMyDisciplineRate(userId, days ? parseInt(days, 10) : 30);
  }
}
