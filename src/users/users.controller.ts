import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateAvatarDto } from './dto/update-avatar.dto';
import { Role } from '@prisma/client';
import { Auth } from '../core/decorators/global.auth.decorator';
import { Public } from './../core/decorators/Public.decorator';
import { CurrentUser } from './../core/decorators/current-user.decorator';
import { ResponseHelper } from '../core/helpers/response.helper';
import {
  ApiTags,
  ApiBearerAuth,
  ApiProperty,
  ApiPropertyOptional,
  ApiOperation,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import {
  InvalidImageFileException,
  ImageSizeLimitException,
  NoFileProvidedException,
} from '../core/domain-exceptions/upload.exceptions';

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
      body.fullName = 'User';
    }
    if (!body.passwordHash) {
      body.passwordHash = body.password;
    }
    const createUserDto = body as CreateUserDto;
    if (createUserDto.role === Role.MANAGER || createUserDto.role === Role.SUPER_ADMIN) {
      return this.usersService.createManager(createUserDto);
    } else {
      return this.usersService.creatEmploye(createUserDto);
    }
  }

  @Public()
  @Post('loginIn')
  @ApiOperation({ summary: 'تسجيل الدخول للمستخدم' })
  @ApiBody({ type: LoginDto })
  loginIn(@Body() body: any) {
    const password = body.passwordHash || body.password;
    return this.usersService.loginIn(password, body.email);
  }

  @Public()
  @Post('refresh-token')
  @ApiOperation({ summary: 'تجديد الـ Access Token باستخدام الـ Refresh Token' })
  async refreshToken(@Body('refresh_token') refreshToken: string) {
    const result = await this.usersService.refreshToken(refreshToken);
    return ResponseHelper.success(result, 'تم تجديد رمز الوصول بنجاح');
  }

  @Post('logout')
  @ApiOperation({ summary: 'تسجيل الخروج وإبطال جميع جلسات التجديد' })
  async logout(@CurrentUser('userId') userId: string) {
    const result = await this.usersService.revokeSessions(userId);
    return ResponseHelper.success(result, 'تم تسجيل الخروج وإبطال الجلسات بنجاح');
  }

  @Get('profile')
  @ApiOperation({ summary: 'جلب الملف الشخصي للمستخدم' })
  getMyProfile(@CurrentUser(['userId', 'role']) user: string[]) {
    const userId = user['userId'];
    const role = user['role'];

    if (role === 'SUPER_ADMIN' || role === 'MANAGER') {
      return this.usersService.getMyManager(userId);
    } else {
      return this.usersService.getMyProfile(userId);
    }
  }

  @Get('search_Word')
  @ApiOperation({ summary: 'البحث عن المستخدمين والموظفين' })
  search(
    @Query('search_Word') search_Word?: string,
  @Query('word') word?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('role') role?: string,
    @Query('includeDiscipline') includeDiscipline?: string,
  ) {
    const term = search_Word ?? word ?? '';
    return this.usersService.search(
      term,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 12,
      role,
      includeDiscipline === 'true' || includeDiscipline === undefined || includeDiscipline === '1',
    );
  }

  @Patch('update-my-profile')
  @ApiOperation({ summary: 'تحديث البيانات الشخصية للمستخدم (الاسم، الهاتف، البريد، المسمى الوظيفي)' })
  update(@CurrentUser('userId') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🖼️ AVATAR UPLOAD & UPDATE ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════

  @Post('upload-avatar')
  @ApiOperation({ summary: 'رفع صورة شخصية جديدة للمستخدم (JPEG, PNG, WEBP حتى 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'ملف الصورة الشخصية المراد رفعه',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = join(process.cwd(), 'uploads', 'avatars');
          if (!existsSync(uploadPath)) {
            mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req: any, file, cb) => {
          const userPart = req.user?.userId || randomUUID().slice(0, 8);
          const ext = extname(file.originalname).toLowerCase() || '.webp';
          const filename = `avatar-${userPart}-${Date.now()}${ext}`;
          cb(null, filename);
        },
      }),
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
      fileFilter: (req, file, cb) => {
        const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
        if (!allowedMimes.includes(file.mimetype)) {
          return cb(new InvalidImageFileException('JPEG, PNG, WEBP'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadAvatar(
    @CurrentUser('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new NoFileProvidedException();
    }
    return this.usersService.uploadAvatar(userId, file);
  }

  @Patch('update-avatar')
  @ApiOperation({ summary: 'تحديث رابط الصورة الشخصية للمستخدم مباشرة' })
  updateAvatar(
    @CurrentUser('userId') userId: string,
    @Body() dto: UpdateAvatarDto,
  ) {
    return this.usersService.updateAvatar(userId, dto.imageProfile);
  }

  @Delete('delete-my-profile')
  @ApiOperation({ summary: 'حذف الحساب الشخصي' })
  remove(@CurrentUser('userId') id: string) {
    return this.usersService.remove(id);
  }
}
