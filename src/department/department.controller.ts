import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { CreateDepartmentDto } from './dto/create-department.dto';
import { UpdateDepartmentDto } from './dto/update-department.dto';
import { Auth } from '../core/decorators/golebl.auth.decorator';
import { Role } from '@prisma/client';
import { CurrentUser } from 'src/core/decorators/currntUser.decorator';

@Controller('department')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  // GET /department — جميع الأقسام التابعة للمدير مع عدد الموظفين والورديات
  @Auth(Role.SUPER_ADMIN)
  @Get()
  findAll(@CurrentUser('userId') userId: string) {
    return this.departmentService.findAll(userId);
  }

  // GET /department/list/names — أسماء الأقسام فقط للـ dropdowns (أي مستخدم مسجل)
  @Auth()
  @Get('list/names')
  listNames() {
    return this.departmentService.listNames();
  }

  // GET /department/:id — تفاصيل قسم واحد
  @Auth(Role.SUPER_ADMIN)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.departmentService.findOne(id);
  }

  // POST /department — إنشاء قسم جديد
  @Auth(Role.SUPER_ADMIN)
  @Post()
  create(@CurrentUser('userId') userId: string, @Body() dto: CreateDepartmentDto) {
    return this.departmentService.create(userId, dto);
  }

  // PATCH /department/:id — تعديل قسم
  @Auth(Role.SUPER_ADMIN)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.departmentService.update(id, dto);
  }

  // DELETE /department/:id — حذف قسم
  @Auth(Role.SUPER_ADMIN)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.departmentService.remove(id);
  }
}
