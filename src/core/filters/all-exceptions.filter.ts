import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // 1. استخراج معلومات المستخدم المتأثر بالخطأ
    const user = (request as any).user;
    const affectedUser = user
      ? {
          userId: user.userId || user.id || 'N/A',
          email: user.email || 'N/A',
          role: user.role || 'N/A',
        }
      : null;

    const isDev = process.env.NODE_ENV === 'development';
    const isAdmin = user?.role === 'SUPER_ADMIN';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'حدث خطأ داخلي في الخادم، يرجى المحاولة لاحقاً.';
    let errorCategory = 'خطأ غير معروف في النظام (Unknown System Error)';
    let rawCause: any = null;

    // 2. تصنيف الأخطاء وتحديد الرسائل بناءً على الفئات وصلاحيات المستخدم
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resObj = exceptionResponse as any;
        rawCause = resObj.message || exception.message;

        // للتحقق من أخطاء التحقق (Validation Errors)
        if (Array.isArray(resObj.message)) {
          const validationErrors = resObj.message as string[];
          message = `البيانات المدخلة غير صحيحة (${validationErrors.length} خطأ). يرجى تصحيح الأخطاء التالية:`;
          rawCause = {
            type: 'VALIDATION_ERRORS',
            errors: validationErrors,
            count: validationErrors.length,
          };
        } else {
          message = resObj.message || exception.message;
        }
      } else {
        message = exception.message;
      }

      // تصنيف الاستثناءات العادية لـ HTTP
      switch (status) {
        case HttpStatus.BAD_REQUEST:
          errorCategory = 'خطأ في التحقق من البيانات (Validation / Client Request Error)';
          break;
        case HttpStatus.UNAUTHORIZED:
          errorCategory = 'خطأ في المصادقة والتحقق من الهوية (Authentication Issue)';
          message = 'يرجى تسجيل الدخول بشكل صحيح للوصول إلى هذا المورد.';
          break;
        case HttpStatus.FORBIDDEN:
          errorCategory = 'غير مصرح لك بالوصول (Authorization Constraint / Forbidden)';
          message = 'عذراً، ليس لديك الصلاحية الكافية للوصول إلى هذا المورد.';
          break;
        case HttpStatus.NOT_FOUND:
          errorCategory = 'المورد غير موجود (Resource Not Found)';
          message = 'عذراً، المورد الذي تحاول الوصول إليه غير موجود.';
          break;
        case HttpStatus.CONFLICT:
          errorCategory = 'تعارض في الموارد (Resource Conflict)';
          break;
        default:
          errorCategory = 'خطأ عميل / طلب غير متوافق (Client-Side HTTP Exception)';
          break;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;
      errorCategory = 'خطأ في تكامل قاعدة البيانات (Database Integrity / Prisma Constraint)';
      rawCause = {
        code: exception.code,
        meta: exception.meta,
        message: exception.message,
      };

      // معالجة أخطاء قاعدة البيانات الحساسة وحمايتها
      switch (exception.code) {
        case 'P2002':
          status = HttpStatus.CONFLICT;
          // إظهار التفاصيل التفصيلية للحقول فقط لوجه الأدمن أو المطور
          if (isAdmin || isDev) {
            const targetFields = exception.meta?.target
              ? ` (${(exception.meta.target as string[]).join(', ')})`
              : '';
            const model = (exception.meta?.modelName as string) || '';
            const modelMessages: Record<string, string> = {
              Department: `يوجد قسم بنفس الاسم مسبقاً${targetFields}. يرجى اختيار اسم مختلف.`,
              Shift: `توجد وردية بنفس البيانات مسبقاً${targetFields}.`,
              User: `يوجد مستخدم بنفس البيانات مسبقاً${targetFields}.`,
              Attendance: `تم تسجيل الحضور مسبقاً لهذا اليوم${targetFields}.`,
            };
            message = modelMessages[model]
              || `تم إدخال قيمة موجودة مسبقاً في الحقول الفريدة${targetFields}.`;
          } else {
            message = 'عذراً، البيانات التي تحاول إدخالها مسجلة مسبقاً في النظام ولا يمكن تكرارها.';
          }
          break;
        case 'P2003':
          if (isAdmin || isDev) {
            message = 'خطأ في علاقات البيانات (Foreign Key Constraint Failed). المورد المرتبط الذي تحاول الإشارة إليه غير موجود.';
          } else {
            message = 'حدث خطأ في ترابط البيانات، يرجى التأكد من صحة المعرفات المرتبطة.';
          }
          break;
        case 'P2014':
          status = HttpStatus.BAD_REQUEST;
          if (isAdmin || isDev) {
            message = 'لا يمكن حذف هذا السجل لأنه مرتبط ببيانات أخرى. يجب إزالة أو نقل البيانات المرتبطة أولاً.';
          } else {
            message = 'لا يمكن إتمام عملية الحذف بسبب ارتباط البيانات.';
          }
          break;
        case 'P2021':
          status = HttpStatus.INTERNAL_SERVER_ERROR;
          message = 'خطأ في هيكل قاعدة البيانات. يرجى التواصل مع المطور لتشغيل الترحيل (migration).';
          break;
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'السجل المطلوب تعديله أو حذفه غير موجود في النظام.';
          break;
        default:
          if (isAdmin || isDev) {
            message = `فشلت عملية قاعدة البيانات برمز الخطأ الداخلي: ${exception.code}`;
          } else {
            message = 'فشلت معالجة الطلب في قاعدة البيانات بسبب مشكلة في البيانات المدخلة.';
          }
          break;
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      errorCategory = 'خطأ في استعلام قاعدة البيانات (Prisma Query Validation Error)';
      rawCause = exception.message;

      if (isAdmin || isDev) {
        message = 'فشلت عملية التحقق من صحة حقول الاستعلام بقاعدة البيانات.';
      } else {
        message = 'هناك حقول مفقودة أو غير صالحة في استعلامك، يرجى مراجعة التنسيقات.';
      }
    } else if (exception instanceof Prisma.PrismaClientInitializationError) {
      status = HttpStatus.SERVICE_UNAVAILABLE;
      errorCategory = 'خطأ في تهيئة الاتصال بقاعدة البيانات (Prisma Database Connection Failed)';
      rawCause = exception.message;
      message = 'فشل النظام في الاتصال بقاعدة البيانات في الوقت الحالي. تم تسجيل المشكلة للتحقق.';
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorCategory = 'خطأ داخلي غير متوقع في السيرفر (Uncaught Runtime Exception)';
      rawCause = exception.message;

      if (isAdmin || isDev) {
        message = `خطأ وقت التشغيل: ${exception.message}`;
      } else {
        message = 'حدث خطأ غير متوقع أثناء معالجة طلبك. يرجى إبلاغ الإدارة أو المطور.';
      }
    }

    // 3. تسجيل تفاصيل الخطأ بدقة في نظام السجلات الداخلي للسيرفر (Internal Server Logs)
    const logDetails = {
      method: request.method,
      url: request.url,
      statusCode: status,
      category: errorCategory,
      affectedUser,
      query: request.query,
      requestBody: isDev ? request.body : undefined,
      systemMessage: exception instanceof Error ? exception.message : String(exception),
    };
    this.logger.error(
      `[AllExceptionsFilter] Exception details: ${JSON.stringify(logDetails)}`,
      exception instanceof Error ? exception.stack : '',
    );

    // 4. صياغة رد الـ JSON النهائي الموحد والآمن
    const showCause = isAdmin || isDev;

    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      errorCategory,
      message,
      cause: showCause ? rawCause : 'تم إخفاء التفاصيل الفنية لأسباب تتعلق بأمن البيانات والحماية.',
      affectedUser,
    });
  }
}

