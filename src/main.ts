import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './core/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // تفعيل CORS للسماح للواجهة الأمامية بالاتصال
  // CORS_ORIGIN يمكن أن يكون قائمة مفصولة بفاصلة لدعم بيئات متعددة
  // مثال: CORS_ORIGIN="https://badi-flata.github.io,http://localhost:3000"
  const rawOrigins = process.env.CORS_ORIGIN || 'http://localhost:3000';
  const allowedOrigins = rawOrigins.split(',').map((o) => o.trim());

  app.enableCors({
    origin: (origin, callback) => {
      // السماح بالطلبات بدون origin (مثل Postman أو curl)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`CORS: origin "${origin}" is not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // تفعيل التحقق التلقائي من البيانات المدخلة عبر DTOs
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,            // يحذف الحقول غير المعرفة في الـ DTO
      forbidNonWhitelisted: true, // يرفض الطلب إذا أرسل حقول غير معرفة
      transform: true,            // يحول القيم للأنواع المطلوبة تلقائياً
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(process.env.PORT ?? 9000);
}
bootstrap();
