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
    // Access token (صلاحية 15 دقيقة)
    const accessToken = this.jwtService.sign(accessPayload, { expiresIn: '15m' });

    // Refresh token فريد مشفر (صلاحية 7 أيام)
    const refreshTokenRaw = crypto.randomBytes(40).toString('hex');
    const refreshExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const tokenHash = this.hashToken(refreshTokenRaw);

    // معرف المستخدم الفعلي لجدول RefreshSession (لضمان صحة foreign key على جدول User)
   

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
      expires_in: 15 * 60,
    };
  }

  // تجديد الجلسة مع كشف إعادة الاستخدام (Token Reuse Detection)
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

    // كشف استخدام نفس الـ Refresh Token بعد تدويره/إلغائه
    if (session && session.isRevoked) {
      // اشتباه اختراق: إلغاء جميع جلسات المستخدم فوراً لحمايته
      await this.prisma.refreshSession.updateMany({
        where: { userId: session.userId },
        data: { isRevoked: true },
      });
      throw new UnauthorizedException("تم اكتشاف محاولة إعادة استخدام رمز تجديد منتهي/ملغي. تم تسجيل الخروج لجميع الجلسات حمايةً لحسابك.");
    }

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException("رمز التجديد غير صالح أو منتهي الصلاحية.");
    }

    // إبطال الرمز القديم (Token Rotation)
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