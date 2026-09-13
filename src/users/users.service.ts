import { Injectable, UnauthorizedException, BadRequestException, NotFoundException, ForbiddenException, InternalServerErrorException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from './../prisma/prisma.service';
import { AuthService } from '../core/auth/auth.service';
import { Prisma ,Role } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as bcrypt    from 'bcrypt';
import { UtilitiesService } from '../utilities/utilities.service';
import { StatisticsHelperService } from '../utilities/statistics-helper.service';
import { InvalidCredentialsException, InsufficientPermissionsException } from '../core/domain-exceptions/auth.exceptions';
import { DepartmentNotFoundException } from '../core/domain-exceptions/department.exceptions';
import { ShiftNotFoundException } from '../core/domain-exceptions/shift.exceptions';
import { NoFileProvidedException } from '../core/domain-exceptions/upload.exceptions';
import { ResponseHelper } from '../core/helpers/response.helper';
import { Modes } from '../utilities/types/dashboard-registry.types';
import { UploadedFilePayload } from '../core/interfaces/global-response.interface';

@Injectable()
export class UsersService {

  constructor(
    private prisma: PrismaService,
    private jwt: AuthService,
    private statsHelper: StatisticsHelperService,
    private utilities: UtilitiesService
  ) { }
 
  // إنشاء مدير جديد
  async createManager(Dto: CreateUserDto) {
    if (Dto.role === Role.SUPER_ADMIN) {
      throw new ForbiddenException('لا يمكن إنشاء حساب مدير نظام عام عبر التسجيل المباشر');
    }
    const targetRole = Role.MANAGER;
    const fullName = Dto.fullName || 'User';
    const passwordHash = await bcrypt.hash(Dto.passwordHash || '', 10);
    const Id = randomUUID();
    const profileId =  randomUUID()
    
    // السماح لـ Prisma برمي الاستثناء مباشرة ليلتقطه AllExceptionsFilter ويحلل رموز الأخطاء بدقة
    const newManager = await this.prisma.user.create({ 
      data: { 
        id: Id, 
        fullName: fullName,
        email: Dto.email,
        passwordHash: passwordHash,
        phone: Dto.phone,
        role: targetRole,
        adminProfile: {
          create: {
            id: profileId,
          },
        },
      },
      include: { adminProfile: true },
    });
    const adminProfileId = newManager.adminProfile?.id || profileId;
    const tokenResult = await this.jwt.generateTokenPair(fullName, adminProfileId, targetRole, Id);
    return ResponseHelper.created(
      {
        token: tokenResult.access_token,
        refresh_token: tokenResult.refresh_token,
        user: newManager,
      },
      'تم إنشاء حساب المدير بنجاح'
    );
  }

  // أنشاء عامل مع ربط بالقسم و المدير
  async creatEmploye(Dto:CreateUserDto) {
    if(Dto.role !== Role.EMPLOYEE) {
      throw new BadRequestException('عذراً، يجب أن يكون دور المستخدم موظف/عامل (EMPLOYEE).');
    }
   

    const Id = randomUUID();
    const profileId =  randomUUID()

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
            id:profileId,
            departmentId:null,
            shiftId:null,
            managerId:null
          }
        }
      },
      include:{employeeProfile:true}
    });

    const empProfileId = Employe.employeeProfile?.id || Id;
    const tokenResult = await this.jwt.generateTokenPair( fullName,empProfileId , Dto.role, Id);
    return ResponseHelper.created(
      {
        token: tokenResult.access_token,
        refresh_token: tokenResult.refresh_token,
        user: Employe,
      },
      'تم إنشاء حساب الموظف بنجاح'
    );
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
   
    // توليد زوج الرموز (Access Token + Refresh Token) باستخدام profileId
    const profileId = user.role === 'EMPLOYEE' 
      ? (user.employeeProfile?.id || user.id) 
      : (user.adminProfile?.id || user.id);
    const tokenResult = await this.jwt.generateTokenPair( user.fullName , profileId , user.role, user.id);

    return ResponseHelper.success(
      {
        token: tokenResult.access_token,
        refresh_token: tokenResult.refresh_token,
        Profile: userProfile,
        user: user
      },
      'تم تسجيل الدخول بنجاح'
    );
  }
  
async getMyProfile(userId: string) {

    const profileId = await this.prisma.employeeProfile.findUnique({
      where:{id:userId},
      include:{user:true}
    })
    const user =   await this.prisma.user.findUnique({
      where: { id: profileId?.userId },
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
       const profileId = await this.prisma.adminProfile.findUnique({
      where:{id:userId},
      include:{user:true}
    })
    const user =   await this.prisma.user.findUnique({
      where: { id: profileId?.userId },
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


  async update(userId: string ,role:string, Dto: UpdateUserDto) {

   const isManager = role ==="MANAGER" || role === "SUPER_ADMIN"

   const profile= isManager ? await this.prisma.adminProfile.findUnique({
     where:{id:userId}
   }): await this.prisma.employeeProfile.findUnique({
     where:{id:userId}
   })

    const data: any = {};
    if (Dto.fullName) data.fullName = Dto.fullName;
    if (Dto.email) data.email = Dto.email;
    if (Dto.phone) data.phone = Dto.phone;
    if (Dto.jobTitle) data.jobTitle = Dto.jobTitle;
    if (Dto.imageProfile) data.imageProfile = Dto.imageProfile;
  
    const updatedUser = await this.prisma.user.update({
      where: { id: profile?.userId },
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
  async uploadAvatar(userId: string, file: UploadedFilePayload ,role:string) {
    if (!file) {
      throw new NoFileProvidedException();
    }

    const relativePath = `/uploads/avatars/${file.filename}`;
    console.log("role:",role)
    
   const isAdmin = role ==="MANAGER" ||role === "SUPER_ADMIN"
    const profileId =isAdmin? await this.prisma.adminProfile.findUnique({
      where:{id:userId},
     
    }):
     await this.prisma.employeeProfile.findUnique({
      where:{id:userId},
    
    });
    const updatedUser = await this.prisma.user.update({
      where: { id: profileId?.userId },
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
  async updateAvatar(userId: string, imageProfile: string , role:string) {
    console.log("role:",role)
    const isAdmin = role ==="MANAGER" ||role === "SUPER_ADMIN"
    const profileId =isAdmin? await this.prisma.adminProfile.findUnique({
      where:{id:userId},
     
    }):
     await this.prisma.employeeProfile.findUnique({
      where:{id:userId},
    
    });
    const updatedUser = await this.prisma.user.update({
      where: { id: profileId?.userId },
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

  async search(search: string, page:number , limit:number , role?: string, discipline = false) {
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

  async refreshToken(refreshToken: string) {
    return this.jwt.refreshAccessToken(refreshToken);
  }

  async revokeSessions(userId: string) {
    return this.jwt.revokeUserSessions(userId);
  }
}
