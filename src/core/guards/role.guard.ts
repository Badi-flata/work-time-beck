// common/guards/roles.guard.ts

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/role.decorator';
import { IS_PUBLIC_KEY } from '../decorators/Public.decorator';

// الـ Guard الذي يتحقق من أن المستخدم لديه الدور المطلوب
// The Guard that verifies the user has the required role
@Injectable()
export class RolesGuard implements CanActivate {

  // Reflector يسمح لنا بقراءة الـ metadata المرفقة بالـ handler
  // Reflector allows us to read metadata attached to the handler
  constructor(private reflector: Reflector) {}

  /**
   * الدالة الأساسية — ترجع true للسماح أو ترمي خطأ للمنع
   * Core method — returns true to allow, or throws to deny
   */
  canActivate(context: ExecutionContext): boolean {

    // نتحقق أولاً: هل هذا الـ endpoint معلّم كـ @Public()؟
    // First check: is this endpoint marked as @Public()?
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    // إذا كان عاماً، نسمح بالمرور بدون تحقق
    // If it's public, allow access without verification


    // 1. نقرأ الأدوار المطلوبة من الـ metadata المرفقة بالـ handler
    // 1. Read required roles from metadata attached to the handler
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),  // أولاً نبحث في الـ method
      context.getClass(),    // ثم في الـ class
    ]);



    // إذا لم تُحدَّد أدوار، نسمح للجميع بالمرور
    // If no roles specified, allow everyone through
    if (!requiredRoles || requiredRoles.length === 0 || isPublic) {
      return true;
    }

    // 2. نحصل على بيانات المستخدم من الطلب
    // 2. Get user data from the request (usually set by auth middleware/guard)
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // إذا لم يوجد مستخدم مسجل الدخول، نمنع الوصول
    // If no authenticated user exists, deny access
    if (!user) {
      throw new ForbiddenException(
        'يجب تسجيل الدخول أولاً / You must be logged in first',
      );
    }

    // 3. نتحقق: هل دور المستخدم موجود في الأدوار المطلوبة؟
    // 3. Check: is the user's role among the required roles?
    const hasRole = requiredRoles.some((role) => user.role === role);

    if (!hasRole) {
      throw new ForbiddenException(
        `ليس لديك صلاحية. الأدوار المطلوبة: ${requiredRoles.join(', ')} / ` +
        `Insufficient permissions. Required roles: ${requiredRoles.join(', ')}`,
      );
    }

    return true;
  }
}
