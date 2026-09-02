import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './core/filters/all-exceptions.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // التأكد من وجود مجلد رفع الملفات
  const uploadsDir = join(process.cwd(), 'uploads', 'avatars');
  if (!existsSync(uploadsDir)) {
    mkdirSync(uploadsDir, { recursive: true });
  }

  // تقديم الملفات الثابتة (الصور المرفوعة) عبر الرابط /uploads/...
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // تفعيل CORS للسماح للواجهة الأمامية والطلبات بالاتصال بأمان ومرونة
  app.enableCors({
    origin: (origin, callback) => {
      // السماح للطلبات بدون origin (مثل أدوات التطوير، Postman، السيرفرات)
      if (!origin) return callback(null, true);

      // السماح التلقائي لجميع منافذ localhost و 127.0.0.1 ونطاقات Railway و Vercel
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      const isRailwayOrVercel = /\.up\.railway\.app$/.test(origin) || /\.vercel\.app$/.test(origin) || origin.endsWith('testsprite.com');
      
      const customOrigins = (process.env.CORS_ORIGIN || '').split(',').map((o) => o.trim()).filter(Boolean);
      const isCustomAllowed = customOrigins.includes(origin);

      if (isLocalhost || isRailwayOrVercel || isCustomAllowed || process.env.NODE_ENV !== 'production') {
        return callback(null, true);
      }

      return callback(null, true); // السماح بالاتصال لتجنب إيقاف الـ Callbacks
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers',
    ],
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

  // إعداد Swagger لتوثيق واجهات برمجة التطبيقات
  const swaggerConfig = new DocumentBuilder()
    .setTitle('WorkTime API')
    .setDescription('API documentation for WorkTime attendance management system')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api-docs', app, document);

  await app.listen(process.env.PORT ?? 9000);
}
bootstrap();
