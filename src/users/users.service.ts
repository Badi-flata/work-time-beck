import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from './../prisma/prisma.service';
import { AuthService } from '../core/auth/auth.service';
import { Prisma ,Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt    from 'bcrypt';
import { UtilitiesService } from '../utilities/utilities.service';
import { StatisticsHelperService } from 'src/utilities/statistics-helper.service';
import { InvalidCredentialsException, InsufficientPermissionsException } from '../core/domain-exceptions/auth.exceptions';
import { DepartmentNotFoundException } from '../core/domain-exceptions/department.exceptions';
import { ShiftNotFoundException } from '../core/domain-exceptions/shift.exceptions';
import { NoFileProvidedException } from '../core/domain-exceptions/upload.exceptions';
import { ResponseHelper } from '../core/helpers/response.helper';
import { Modes } from 'src/utilities/types/dashboard-registry.types';
import { UploadedFilePayload } from '../core/interfaces/global-response.interface';

@Injectable()
export class UsersService {

  constructor(
    private prisma: PrismaService,
    private jwt: AuthService,
    private statsHelper: StatisticsHelperService,
    private utilities: UtilitiesService
  ) { }
 
  // أنشاء مدير 
  async createManager(Dto: CreateUserDto) {
    if(Dto.role !== Role.SUPER_ADMIN){
      throw new InsufficientPermissionsException();
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
        jobTitle:Dto.jobTitle,
        email:Dto.email,
        passwordHash:passwordHash,
        phone:Dto.phone,
        role:Dto.role,
        employeeProfile:{
          create:{
            id:Id,
            departmentId:depId.id,
            shiftId:depId.shift[0]?.id,
            managerId:null
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

    const userProfile = user?.role === "EMPLOYEE" ? user?.employeeProfile: user?.adminProfile 
   
    if(!user) throw new InvalidCredentialsException();
      
    // التحقق من كلمة المرور 
    const isValid = await bcrypt.compare(passwordHash , user.passwordHash );

    if(!isValid) throw new InvalidCredentialsException();
   
    // توليد الـ Access Token 
    const tokenResult = await this.jwt.generateTokenPair( user.fullName , user.id , user.role);

    return {
      token: tokenResult.access_token,
      Profile: userProfile,
      user: user
    };
  }
  
async getMyProfile(userId: string) {
    const user =   await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        imageProfile:true,
        jobTitle:true,
         fullName:true,
         phone:true,
         email:true,
         role:true,
         createdAt:true,
         employeeProfile: {
          select: {
            id:true,
            salary:true,
            isWorking:true,
            department: {
              select:{
                name:true,
              }
            },
            shift: {
              select:{
                name:true,
              }
            },
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
        }}
      });

    if (!user) throw new NotFoundException('المستخدم غير موجود');

 
      const statis = user.employeeProfile ? await this.statsHelper
      .computeDisciplineRate(user.employeeProfile.id , Modes.ALL): null;
      return { user,  mate:statis ,messageSuccessd:"تم جلب بيانات الموظف بنجاح" };
  }

  async getMyManager(userId: string) {
    const user =   await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        imageProfile:true,
        jobTitle:true,
         fullName:true,
         phone:true,
         email:true,
         role:true,
         createdAt:true,
         adminProfile: {
          select: {
            managedDepartments: {
              select:{
                name:true,
                shift: {
              select:{
                name:true,
              }
            }
              }
            },
            subordinates: {
              select:{
                user:{
                select: {
                  id:true,
                fullName: true,
                email: true,
                phone: true
              }}}
            }
          }
        }}
      });

    if (!user) throw new NotFoundException('المستخدم غير موجود');

    const OrginzationLabel= await this.statsHelper.computeOrganizationDiscipline(userId,Modes.ALL)
      return {
        user ,
       mate: OrginzationLabel,
        messageSuccessd:"تم جلب بيانات المدير بنجاح"
        };
  }


  async update(userId: string, Dto: UpdateUserDto) {
    const data: any = {};
    if (Dto.fullName) data.fullName = Dto.fullName;
    if (Dto.email) data.email = Dto.email;
    if (Dto.phone) data.phone = Dto.phone;
    if (Dto.jobTitle) data.jobTitle = Dto.jobTitle;
    if (Dto.imageProfile) data.imageProfile = Dto.imageProfile;
    
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data,
      
    });



    return {
      user: updatedUser,
      messageSuccessd: `تم تحديث بيانات المستخدم "${updatedUser.fullName}" بنجاح`,
    };
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🖼️ PROFILE AVATAR MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  /**
   * رفع وحفظ الصورة الشخصية للمستخدم وتحديث قاعدة البيانات
   */
  async uploadAvatar(userId: string, file: UploadedFilePayload) {
    if (!file) {
      throw new NoFileProvidedException();
    }

    const relativePath = `/uploads/avatars/${file.filename}`;

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { imageProfile: relativePath },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        jobTitle: true,
        imageProfile: true,
        role: true,
      },
    });

    return ResponseHelper.success(
      {
        imageProfile: relativePath,
        user: updatedUser,
      },
      'تم رفع وتحديث الصورة الشخصية بنجاح'
    );
  }

  /**
   * تحديث رابط الصورة الشخصية مباشرة
   */
  async updateAvatar(userId: string, imageProfile: string) {
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { imageProfile },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        jobTitle: true,
        imageProfile: true,
        role: true,
      },
    });

    return ResponseHelper.success(
      {
        imageProfile,
        user: updatedUser,
      },
      'تم تحديث الصورة الشخصية بنجاح'
    );
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
        where: { managerId: user.adminProfile.userId },
        data: { managerId: null }
      });

      const departments = await this.prisma.department.findMany({
        where: { managerId: user.adminProfile.userId }
      });

      for (const dep of departments) {
        await this.prisma.employeeProfile.updateMany({
          where: { departmentId: dep.id },
          data: { managerId: null, departmentId: null, shiftId: null },
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
