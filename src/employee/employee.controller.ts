import { Controller, Get, Post, Body, Patch, Delete, Query, BadRequestException } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmployeeDto } from './dto/employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CurrentUser } from '../core/decorators/current-user.decorator';
import { Auth } from '../core/decorators/global.auth.decorator';
import { Role } from '@prisma/client';
import { UtilitiesService } from 'src/utilities/utilities.service';
import { Modes } from '../utilities/types/dashboard-registry.types';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';

@ApiTags('employee')
@ApiBearerAuth()
@Auth(Role.EMPLOYEE, Role.SUPER_ADMIN)
@Controller('employee')
export class EmployeeController {
  constructor(
    private readonly employeeService: EmployeeService,
    private readonly utility: UtilitiesService
  ) {}

  @Post('set-manager')
  @ApiOperation({ summary: 'تعيين المدير للموظف' })
  addOrChangeManager(@Body() employeeDto: EmployeeDto, @CurrentUser('userId') userId: string) {
    if (!employeeDto.managerId) {
      throw new BadRequestException('معرف المدير مطلوب / managerId is required');
    }
    return this.employeeService.addOrChangeManager(employeeDto.managerId, userId);
  }

  @Patch('update-profile')
  @ApiOperation({ summary: 'تحديث بيانات الملف الشخصي للموظف' })
  update(@CurrentUser('userId') userId: string, @Body() updateEmployeeDto: UpdateEmployeeDto) {
    return this.employeeService.update(userId, updateEmployeeDto);
  }

  @Get('today-status')
  @ApiOperation({ summary: 'جلب حالة الحضور لليوم الحالي' })
  getTodayStatus(@CurrentUser('userId') userId: string) {
    return this.utility.getTodayAttendanceStatus(userId);
  }

  @Get('my-dashboard')
  @ApiOperation({ summary: 'جلب لوحة تحكم الموظف' })
  getMyDashboard(
    @CurrentUser('userId') userId: string,
    @Query('mode') mode: Modes = Modes.WEEKLY,
    @Query('dateAnchor') dateAnchor: string,
    @Query('employeeId') employeeId?: string,
) {
    return this.employeeService.getMyDashboard(userId,mode,dateAnchor,employeeId);
  }

  @Get('discipline-rate')
  @ApiOperation({ summary: 'حساب معدل الانضباط للموظف حسب الوضع (أسبوعي، شهري، يومي، كلي) أو عدد الأيام' })
  getMyDisciplineRate(
    @CurrentUser('userId') userId: string,
    @Query('mode') mode?: Modes,
    @Query('dateAnchor') dateAnchor?: string,
    @Query('days') days?: string,
  ) {
    return this.employeeService.getMyDisciplineRate(
      userId,
      mode,
      dateAnchor,
      days ? parseInt(days, 10) : undefined,
    );
  }
}
