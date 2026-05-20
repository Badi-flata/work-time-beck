// common/decorators/public.decorator.ts

import { SetMetadata } from '@nestjs/common';

// مفتاح ثابت للـ metadata — يستخدمه AuthGuard لتخطي التحقق
// Constant key for metadata — used by AuthGuard to skip verification
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * ديكوراتور لتعليم endpoint على أنه عام (لا يحتاج تسجيل دخول)
 * Decorator to mark an endpoint as public (no authentication required)
 *
 * الاستخدام: ضعه فوق أي endpoint تريد أن يكون متاحاً للجميع
 * Usage: Place it above any endpoint you want accessible to everyone
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
