import { Injectable, UnauthorizedException , ExecutionContext} from '@nestjs/common';
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
      throw new Error('You are not authorized to create a manager');
    }
    const passwordHash = await bcrypt.hash(Dto.passwordHash,10)
    const Id = randomUUID()
    try{
   const newManager = await this.prisma.user.create({ 
      data:{ 
         id:Id , 
         fullName:Dto.fullName,
         email:Dto.email,
         passwordHash:passwordHash,
         phone:Dto.phone,
         role:Dto.role,
        adminProfile:{
         create:{
            id:randomUUID(),   
        }}},
      })
    const token =   this.jwt.generateTokenPair( Dto.fullName, Id , Dto.role );
    return {
      token,
      newManager
      }
    
    }catch(e){
        throw new Error(`خطاء في تسجيل المدير : ${e}`)
      }
    
  }

  // أنشاء عامل مع ربط بالقسم و المدير
  async creatEmploye(Dto:CreateUserDto) {

    if(Dto.role !== Role.EMPLOYEE)throw new Error(" لستى عامل")

      const Id = randomUUID()

  try{
  // التحقق من وجود القسم و الربط مع التحويل 
      const depId = await this.prisma.department.findUnique({
        where:{
          name:Dto.departmentName
        },
        include:{
          shift:{
            select:{
              id:true
            }
          }
        }
      })

      if(!depId){
        throw new Error(`القسم ${Dto.departmentName} غير موجود `)
      }
      const passwordHash = await bcrypt.hash(Dto.passwordHash,10)

      const Employe = await this.prisma.user.create({
        data:{
          id:Id,
          fullName:Dto.fullName,
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
      })
    const token =   this.jwt.generateTokenPair( Dto.fullName, Id , Dto.role );
    return {
      token,
      Employe
      }}catch(e){
        throw new Error(`خطاء في تسجيل العامل : ${e}`)
      }

  }


  // تسجيل الدخول 
  async loginIn( passwordHash: string ,email:string) {
    try{ 
    // التحقق من وجود المستخدم 
    const user = await this.prisma.user.findUnique({ where: { email } , include:{adminProfile:true ||undefined , employeeProfile:true || undefined} });
   
    if(!user)throw new UnauthorizedException('البريد الالكتروني غير صحيح');
      
    // التحقق من كلمة المرور 
    const isValid = await bcrypt.compare(passwordHash , user.passwordHash )

    if(!isValid) throw new UnauthorizedException('كلمة المورو خطاء');
   
    // توليد الـ Access Token 
    const newJWT =  this.jwt.generateTokenPair( user.fullName , user.id , user.role)

    return {
      token:newJWT,
      Profile:user
    }
  }catch(err){
      console.error(err)
      throw new Error('حدث خطاء في تسجيل الدخول')
    }
  }
  



 async update(userId: string , Dto: UpdateUserDto) {
    return this.prisma.user.update({
      where:{
        id:userId,
      },
      data:{
        ...Dto 
           },
     });
  }

  async search(search: string ){
    return this.utilities.searchUsers(search);
  }



  remove(Id: string) {
    return this.prisma.user.delete({
      where:{id:Id},
    });
  }
}
