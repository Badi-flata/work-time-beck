import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Role } from '@prisma/client';
import { Auth } from '../core/decorators/golebl.auth.decorator';
import { Public } from './../core/decorators/Public.decorator';
import { CurrentUser } from './../core/decorators/currntUser.decorator';
import { ApiTags, ApiBearerAuth, ApiProperty, ApiPropertyOptional, ApiOperation, ApiBody } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'admin@worktime.sa', description: 'البريد الإلكتروني' })
  email: string;

  @ApiPropertyOptional({ example: 'Admin@2026', description: 'كلمة المرور' })
  password?: string;

  @ApiPropertyOptional({ example: 'Admin@2026', description: 'كلمة المرور البديلة' })
  passwordHash?: string;
}

@ApiTags('users')
@ApiBearerAuth()
@Auth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @Post('logUp') 
  @ApiOperation({ summary: 'إنشاء حساب جديد (مدير أو موظف)' })
  @ApiBody({ type: CreateUserDto })
  createManager(@Body() body: any) {
    if (!body.fullName) {
      body.fullName =  'User';
    }
    if (!body.passwordHash) {
      body.passwordHash = body.password;
    }
    const createUserDto = body as CreateUserDto;
    if(createUserDto.role === Role.MANAGER || createUserDto.role === Role.SUPER_ADMIN){
      return this.usersService.createManager(createUserDto);
    }
    else{
      return this.usersService.creatEmploye(createUserDto);
    }
  }


 @Public()
 @Post("loginIn")
 @ApiOperation({ summary: 'تسجيل الدخول للمستخدم' })
 @ApiBody({ type: LoginDto })
 loginIn(@Body() body: any) {
    const password = body.passwordHash || body.password;
    return this.usersService.loginIn(password, body.email);
  }

 


  @Get('search_Word')
  search(
    @Query('search_Word') search_Word: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: string,
    @Query('includeDiscipline') includeDiscipline?: string,
  ) {
    return this.usersService.search(
      search_Word,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 10,
      role,
      includeDiscipline === 'true',
    );
  }


  @Patch('updateMyProfile')
  update(@CurrentUser('userId') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete('deleteMyProfile')
  remove(@CurrentUser('userId') id: string) {
    return this.usersService.remove(id);
  }
}
