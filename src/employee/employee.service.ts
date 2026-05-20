import { Injectable, NotFoundException } from '@nestjs/common';
import { EmployeeDto } from './dto/employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class EmployeeService {
  constructor(private prisma: PrismaService) { }

  async getMyProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        employeeProfile: {
          include: {
            department: true,
            shift: true,
            manager: {
              include: {
                user: {
                  select: {
                    fullName: true,
                    email: true,
                    phone: true
                  }
                }
              }
            }
          }
        }
      }
    });
    if (!user) throw new NotFoundException('المستخدم غير موجود');
    return user;
  }

  async addOrChangeManager(managerId: string, MyId: string) {
    const manager = await this.prisma.adminProfile.findUnique({
      where: { id: managerId }
    });
    if (!manager) throw new NotFoundException('المدير غير موجود');

    await this.prisma.employeeProfile.update({
      where: { userId: MyId },
      data: { managerId: managerId }
    });

    return { message: 'تم تعيين المدير بنجاح' };
  }

  async update(MyId: string, updateEmployeeDto: UpdateEmployeeDto) {
    const updatedUser = await this.prisma.user.update({
      where: { id: MyId },
      data: {
        fullName: updateEmployeeDto.fullName,
        email: updateEmployeeDto.email,
        phone: updateEmployeeDto.phone
      }
    });
    return updatedUser;
  }
}
