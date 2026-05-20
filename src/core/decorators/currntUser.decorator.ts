// common/decorators/current-user.decorator.ts

import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';

/**
 * ديكوراتور لاستخراج بيانات المستخدم المسجل من الطلب
 * Decorator to extract the authenticated user from the request
 *
 * بدلاً من أن نكتب في كل مرة:
 *   const user = request.user;
 *   const email = user.email;
 *
 * نكتب ببساطة:
 *   @CurrentUser() => user
 *   @CurrentUser(,,'email' , 'role') => email , role
 */
export const CurrentUser = createParamDecorator(
  (data: string | string[] | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    if (!user) return null;

    if (typeof data === 'string') {
      return user[data];
    }

    if (Array.isArray(data)) {
      const result: Record<string, any> = {};
      for (const field of data) {
        result[field] = user[field];
      }
      return result;
    }

    return user;
  },
);
