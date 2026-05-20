
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { IS_PUBLIC_KEY } from '../decorators/Public.decorator';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';

// Guard للتحقق من أن المستخدم مسجل الدخول عبر JWT token
// Guard to verify the user is authenticated via JWT token
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwtService: JwtService ,private reflector:Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
     // نتحقق أولاً: هل هذا الـ endpoint معلّم كـ @Public()؟
    // First check: is this endpoint marked as @Public()?
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY , [
      context.getHandler(),
      context.getClass(),
    ]);
     // إذا كان عاماً، نسمح بالمرور بدون تحقق
    // If it's public, allow access without verification
    if(isPublic) return true;
  
     //  الحصول على الطلب (Request)
    //  Get the Request
    const request = context.switchToHttp().getRequest();

    // استخراج الـ Token من الـ Header
    // Extract the Token from the Header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token is missing');
    }

    const token = authHeader.split(' ')[1];

    try {
      // فك تشفير الـ Token والتحقق من صلاحيته
      // Decode the Token and verify its validity
      const payload = await this.jwtService.verifyAsync(token);

      // نضع بيانات المستخدم في الطلب ليستخدمها الـ RolesGuard لاحقاً
      // Attach user data to request so RolesGuard can use it later
      request.user = payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }

    return true;
  }
}
