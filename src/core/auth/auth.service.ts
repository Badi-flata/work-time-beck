import { Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { Role } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import * as crypto from "crypto";

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  // توليد زوج الرموز وتخزين جلسة الـ Refresh Token في قاعدة البيانات
  async generateTokenPair(username: string, userId: string, role: Role, accountId: string) {
    const accessPayload = { username, userId, role };
    // Access token (صلاحية ساعتين لتوفير تجربة استخدام مطولة ومستقرة)
    const accessToken = this.jwtService.sign(accessPayload, { expiresIn: '2h' });

    // Refresh token فريد مشفر (صلاحية 7 أيام)
    const refreshTokenRaw = crypto.randomBytes(40).toString('hex');
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const tokenHash = this.hashToken(refreshTokenRaw);

    // تنظيف الجلسات المنتهية للمستخدم بدون تعطيل الأجهزة الأخرى
    await this.prisma.refreshSession.deleteMany({
      where: {
        userId: accountId,
        expiresAt: { lt: new Date() },
      },
    }).catch(() => {});

    await this.prisma.refreshSession.create({
      data: {
        tokenHash,
        userId: accountId,
        expiresAt: refreshExpiresAt,
      },
    });

    return {
      access_token: accessToken,
      refresh_token: refreshTokenRaw,
      expires_in: 2 * 60 * 60, // ساعتان (7200 ثانية)
    };
  }

  // تجديد الجلسة بشكل آمن مع دعم تعدد الأجهزة (Multi-Device Support)
  async refreshAccessToken(refreshTokenRaw: string) {
    if (!refreshTokenRaw) {
      throw new UnauthorizedException("لم يتم توفير رمز التجديد (Refresh Token).");
    }

    const tokenHash = this.hashToken(refreshTokenRaw);

    const session = await this.prisma.refreshSession.findUnique({
      where: { tokenHash },
      include: {
        user: {
          select: { id: true, fullName: true, role: true, adminProfile: { select: { id: true } }, employeeProfile: { select: { id: true } } },
        },
      },
    });

    // إذا كان الرمز غير موجود أو منتهي الصلاحية
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException("رمز التجديد غير صالح أو منتهي الصلاحية.");
    }

    // إذا كان هذا الرمز تحديداً تم إبطاله مسبقاً (دون إبطال جلسات الأجهزة الأخرى للمستخدم)
    if (session.isRevoked) {
      throw new UnauthorizedException("تم تدوير رمز التجديد هذا مسبقاً، يرجى تسجيل الدخول مجدداً على هذا الجهاز.");
    }

    // إبطال الرمز القديم لجلسة هذا الجهاز فقط (Token Rotation per session)
    await this.prisma.refreshSession.update({
      where: { id: session.id },
      data: { isRevoked: true },
    });

    // إصدار زوج رموز جديد تماماً باستخدام profileId
    const profileId = session.user.role === 'EMPLOYEE'
      ? (session.user.employeeProfile?.id || session.user.id)
      : (session.user.adminProfile?.id || session.user.id);
    return this.generateTokenPair(
      session.user.fullName,
      profileId,
      session.user.role,
      session.user.id,
    );
  }

  // تسجيل الخروج وإبطال جلسة المستخدم (يدعم إما User.id أو Profile.id)
  async revokeUserSessions(userId: string) {
    // نبحث عن المستخدم إما بالـ User.id أو عبر ربط الـ AdminProfile / EmployeeProfile
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { id: userId },
          { adminProfile: { id: userId } },
          { employeeProfile: { id: userId } },
        ],
      },
      select: { id: true },
    });

    const targetUserId = user ? user.id : userId;
    await this.prisma.refreshSession.updateMany({
      where: { userId: targetUserId },
      data: { isRevoked: true },
    });
    return { message: "تم إبطال جميع الجلسات بنجاح" };
  }
}