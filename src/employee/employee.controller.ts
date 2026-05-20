import { Controller, Get, Post, Body, Patch, Delete } from '@nestjs/common';
import { EmployeeService } from './employee.service';
import { EmployeeDto } from './dto/employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { CurrentUser } from 'src/core/decorators/currntUser.decorator';
import { Auth } from 'src/core/decorators/golebl.auth.decorator';
import { Role } from '@prisma/client';

@Auth(Role.EMPLOYEE)
@Controller('employee')
export class EmployeeController {
  constructor(private readonly employeeService: EmployeeService) {}

  @Get('profile')
  getMyProfile(@CurrentUser('userId') userId: string) {
    return this.employeeService.getMyProfile(userId);
  }

  @Post('set-manager')
  addOrChangeManager(@Body() employeeDto: EmployeeDto, @CurrentUser('userId') userId: string) {
    return this.employeeService.addOrChangeManager(employeeDto.managerId, userId);
  }

  @Patch('update-profile')
  update(@CurrentUser('userId') userId: string, @Body() updateEmployeeDto: UpdateEmployeeDto) {
    return this.employeeService.update(userId, updateEmployeeDto);
  }
}
