// common/decorators/auth.decorator.ts

import { applyDecorators, UseGuards, SetMetadata } from '@nestjs/common';
import { AuthGuard } from '../guards/auth.guard';
import { RolesGuard } from '../guards/role.guard';
import { ROLES_KEY } from './role.decorator';

/**
 * ديكوراتور مُركّب يجمع التحقق من الهوية + الأدوار في سطر واحد
 * Composed decorator combining authentication + roles check in one line
 *
 * بدلاً من كتابة 3 أسطر في كل مرة:
 *   @UseGuards(AuthGuard, RolesGuard)
 *   @Roles('admin', 'doctor')
 *
 * نكتب سطر واحد فقط:
 *   @Auth('admin', 'doctor')
 */
export function Auth(...roles: string[]) {
  return applyDecorators(
    SetMetadata(ROLES_KEY, roles),
    UseGuards(AuthGuard, RolesGuard),
  );
}
