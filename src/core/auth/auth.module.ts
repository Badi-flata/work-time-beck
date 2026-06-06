// auth/auth.module.ts

import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
// import { AuthController } from './auth.controller';

@Global()
@Module({
  imports: [
    // تسجيل JwtModule مع الإعدادات
    // Register JwtModule with configuration
    JwtModule.register({
      // المفتاح السري — يجب أن يكون في .env وليس في الكود!
      // Secret key — MUST be in .env, never in code!
      secret: process.env.JWT_SECRET || 'my-super-secret-key',

      signOptions: {
        // مدة صلاحية الـ token — بعدها ينتهي ويحتاج تجديد
        // Token expiration — after this, it expires and needs refresh
        expiresIn: '30d',
      },
    }),
  ],
  controllers: [],
  providers: [AuthService],
  exports: [JwtModule, AuthService], // نصدّره لتستخدمه modules أخرى مثل AuthGuard
})
export class AuthModule {}
