// common/decorators/roles.decorator.ts

import { SetMetadata } from '@nestjs/common';

// تعريف مفتاح ثابت للـ metadata — لتجنب الأخطاء الإملائية
// Define a constant key for metadata — to avoid typos
export const ROLES_KEY = 'roles';

/**
 * ديكوراتور لتحديد الأدوار المسموح لها بالوصول للـ endpoint
 * Decorator to specify which roles are allowed to access an endpoint
 * @param roles - قائمة الأدوار المسموح بها / List of allowed roles
 *
 * الاستخدام / Usage: @Roles('admin', 'doctor')
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
