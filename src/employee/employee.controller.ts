import { Controller, Get, Post, Body, Patch, Delete, Query, BadRequestException } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmployeeDto } from './dto/employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CurrentUser } from 'src/core/decorators/currntUser.decorator';
import { Auth } from 'src/core/decorators/golebl.auth.decorator';
import { Role } from '@prisma/client';
import { UtilitiesService } from 'src/utilities/utilities.service';

@Auth(Role.EMPLOYEE)
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

  @Get('weekly-report')
  getWeeklyReport(@CurrentUser('userId') userId: string, @Query('startDate') startDate: string) {
    return this.utility.getWeeklyReport(userId, startDate);
  }

  @Get('monthly-report')
  getMonthlyReport(@CurrentUser('userId') userId: string, @Query('startDate') startDate: string) {
    return this.utility.getMonthlyReport(userId, startDate);
  }

  @Get('today-status')
  getTodayStatus(@CurrentUser('userId') userId: string) {
    return this.utility.getTodayAttendanceStatus(userId);
  }
}
