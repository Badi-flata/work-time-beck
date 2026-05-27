import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthService } from 'src/core/auth/auth.service';
import { Prisma ,Role } from '@prisma/client';
import { InstanceLinksHost } from '@nestjs/core/injector/instance-links-host';
import { randomUUID } from 'crypto';
import * as bcrypt    from 'bcrypt';
import { ExceptionsHandler } from '@nestjs/core/exceptions/exceptions-handler';
import { UtilitiesService } from '../utilities/utilities.service';


@Injectable()
export class UsersService {

  constructor(
    private prisma: PrismaService,
    private jwt: AuthService,
    private utilities: UtilitiesService
  ) { }
 
  // أنشاء مدير 
  async createManager(Dto: CreateUserDto) {
    if(Dto.role !== Role.SUPER_ADMIN){
      throw new ForbiddenException('ليس لديك الصلاحية لإنشاء حساب مدير.');
    }
    const fullName = Dto.fullName || 'User';
    const passwordHash = await bcrypt.hash(Dto.passwordHash || '', 10);
    const Id = randomUUID();
    
    // السماح لـ Prisma برمي الاستثناء مباشرة ليلتقطه AllExceptionsFilter ويحلل رموز الأخطاء بدقة
    const newManager = await this.prisma.user.create({ 
      data:{ 
         id:Id , 
         fullName:fullName,
         email:Dto.email,
         passwordHash:passwordHash,
         phone:Dto.phone,
         role:Dto.role,
        adminProfile:{
         create:{
            id:randomUUID(),   
        }}},
      });
    const tokenResult = await this.jwt.generateTokenPair( fullName, Id , Dto.role );
    return {
      token: tokenResult.access_token,
      user: newManager,
      newManager
    };
  }

  // أنشاء عامل مع ربط بالقسم و المدير
  async creatEmploye(Dto:CreateUserDto) {
    if(Dto.role !== Role.EMPLOYEE) {
      throw new BadRequestException('عذراً، يجب أن يكون دور المستخدم موظف/عامل (EMPLOYEE).');
    }
    let depId: any = null;
    if (Dto.departmentName) {
      depId = await this.prisma.department.findUnique({
        where: { name: Dto.departmentName },
        include: { shift: { select: { id: true } } }
      });
      if (!depId) {
        throw new NotFoundException(`القسم المحدد (${Dto.departmentName}) غير موجود في النظام.`);
      }
    } else {
      depId = await this.prisma.department.findFirst({
        include: { shift: { select: { id: true } } }
      });
      if (!depId) {
        throw new NotFoundException('لا يوجد أي قسم في النظام حالياً لربط الموظف به.');
      }
    }

    const Id = randomUUID();

    const fullName = Dto.fullName || 'User';
    const passwordHash = await bcrypt.hash(Dto.passwordHash || '', 10);

    const Employe = await this.prisma.user.create({
      data:{
        id:Id,
        fullName:fullName,
        email:Dto.email,
        passwordHash:passwordHash,
        phone:Dto.phone,
        role:Dto.role,
        employeeProfile:{
          create:{
            id:randomUUID(),
            departmentId:depId.id,
            shiftId:depId.shift[0]?.id,
            managerId:depId.managerId
          }
        }
      }
    });

    const tokenResult = await this.jwt.generateTokenPair( fullName, Id , Dto.role );
    return {
      token: tokenResult.access_token,
      user: Employe,
      Employe
    };
  }


  // تسجيل الدخول 
  async loginIn( passwordHash: string ,email:string) {
    // التحقق من وجود المستخدم 
    const user = await this.prisma.user.findUnique({ 
      where: { email }, 
      include: { 
        adminProfile: true, 
        employeeProfile: true 
      } 
    });
   
    if(!user) throw new UnauthorizedException('البريد الالكتروني أو كلمة المرور غير صحيحة.');
      
    // التحقق من كلمة المرور 
    const isValid = await bcrypt.compare(passwordHash , user.passwordHash );

    if(!isValid) throw new UnauthorizedException('البريد الالكتروني أو كلمة المرور غير صحيحة.');
   
    // توليد الـ Access Token 
    const tokenResult = await this.jwt.generateTokenPair( user.fullName , user.id , user.role);

    return {
      token: tokenResult.access_token,
      Profile: user,
      user: user
    };
  }
  



  async update(userId: string, Dto: any) {
    const data: any = {};
    if (Dto.fullName) {
      data.fullName = Dto.fullName;
    } else if (Dto.firstName || Dto.lastName) {
      data.fullName = [Dto.firstName, Dto.lastName].filter(Boolean).join(' ');
    }
    if (Dto.email) data.email = Dto.email;
    if (Dto.phone) data.phone = Dto.phone;
    if (Dto.phoneNumber) data.phone = Dto.phoneNumber;
    if (Dto.imageProfile) data.imageProfile = Dto.imageProfile;
    if (Dto.role) data.role = Dto.role;
    if (Dto.passwordHash) {
      data.passwordHash = await bcrypt.hash(Dto.passwordHash, 10);
    } else if (Dto.password) {
      data.passwordHash = await bcrypt.hash(Dto.password, 10);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data,
    });

    const parts = updatedUser.fullName.split(' ');
    const firstName = parts[0] || '';
    const lastName = parts.slice(1).join(' ') || '';

    return {
      ...updatedUser,
      firstName,
      lastName,
      phoneNumber: updatedUser.phone,
    };
  }

  async search(search: string, page = 1, limit = 10, role?: string, discipline = false) {
    return this.utilities.searchUsers(search, page, limit, role, discipline);
  }



  async remove(Id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: Id },
      include: { adminProfile: true, employeeProfile: true }
    });

    if (user?.adminProfile) {
      await this.prisma.employeeProfile.updateMany({
        where: { managerId: user.adminProfile.id },
        data: { managerId: null }
      });

      const departments = await this.prisma.department.findMany({
        where: { managerId: user.adminProfile.id }
      });

      for (const dep of departments) {
        await this.prisma.employeeProfile.deleteMany({
          where: { departmentId: dep.id }
        });
        await this.prisma.department.delete({
          where: { id: dep.id }
        });
      }
    }

    return this.prisma.user.delete({
      where: { id: Id },
    });
  }
}
