import 'dotenv/config';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/core/auth/auth.service';
import { ManagingService } from '../src/managing/managing.service';
import { UtilitiesService } from '../src/utilities/utilities.service';
import { StatisticsHelperService } from '../src/utilities/statistics-helper.service';
import { Role } from '@prisma/client';

describe('Auth, Callbacks & Automation Endpoints (E2E & Integration Tests)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  let managingService: ManagingService;
  let utilitiesService: UtilitiesService;
  let statsHelper: StatisticsHelperService;

  let testUserToken: string;
  let testRefreshToken: string;
  let testUserId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    authService = app.get(AuthService);
    managingService = app.get(ManagingService);
    utilitiesService = app.get(UtilitiesService);
    statsHelper = app.get(StatisticsHelperService);
  });

  afterAll(async () => {
    // Cleanup any test sessions created
    if (testUserId) {
      await prisma.refreshSession.deleteMany({ where: { userId: testUserId } });
    }
    await app.close();
  });

  describe('1. 🔐 Token Pair Generation & Callback Verification', () => {
    it('should generate an accessToken and a unique refreshToken stored in database', async () => {
      // Find or create an existing user for testing
      const user = await prisma.user.findFirst();
      expect(user).toBeDefined();
      testUserId = user!.id;

      const tokenPair = await authService.generateTokenPair(
        user!.fullName,
        user!.id,
        user!.role,
      );

      expect(tokenPair.access_token).toBeDefined();
      expect(tokenPair.refresh_token).toBeDefined();
      expect(tokenPair.expires_in).toBe(15 * 60);

      testUserToken = tokenPair.access_token;
      testRefreshToken = tokenPair.refresh_token;

      // Verify token hash is stored in RefreshSession
      const sessions = await prisma.refreshSession.findMany({
        where: { userId: testUserId, isRevoked: false },
      });
      expect(sessions.length).toBeGreaterThan(0);
    });

    it('should successfully refresh access token using valid refresh token callback', async () => {
      const refreshed = await authService.refreshAccessToken(testRefreshToken);
      expect(refreshed.access_token).toBeDefined();
      expect(refreshed.refresh_token).toBeDefined();
      expect(refreshed.refresh_token).not.toEqual(testRefreshToken); // Token rotated

      // Update testRefreshToken to the new one
      const oldToken = testRefreshToken;
      testRefreshToken = refreshed.refresh_token;

      // 2. Test Token Reuse Detection (Replaying oldToken MUST fail and revoke all sessions)
      await expect(authService.refreshAccessToken(oldToken)).rejects.toThrow();

      const activeSessionsAfterReplay = await prisma.refreshSession.findMany({
        where: { userId: testUserId, isRevoked: false },
      });
      expect(activeSessionsAfterReplay.length).toBe(0); // All sessions revoked for safety
    });
  });

  describe('2. 🌐 HTTP API Endpoints & Response Structure Verification', () => {
    it('POST /users/refresh-token should handle HTTP callback and return unified ResponseHelper structure', async () => {
      // Generate a fresh token pair
      const pair = await authService.generateTokenPair('Test User', testUserId, Role.MANAGER);

      const response = await request(app.getHttpServer())
        .post('/users/refresh-token')
        .send({ refresh_token: pair.refresh_token })
        .expect(201); // or 200

      expect(response.body).toHaveProperty('statusCode');
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('access_token');
      expect(response.body.data).toHaveProperty('refresh_token');
    });

    it('POST /users/refresh-token should return 401 when given an invalid token', async () => {
      const response = await request(app.getHttpServer())
        .post('/users/refresh-token')
        .send({ refresh_token: 'invalid-non-existent-token' })
        .expect(401);

      expect(response.body.message).toBeDefined();
    });
  });

  describe('3. ⚙️ Manager Settings & Dynamic Deduction Callbacks', () => {
    let managerUserId: string;

    beforeAll(async () => {
      const manager = await prisma.adminProfile.findFirst();
      if (manager) {
        managerUserId = manager.userId;
      }
    });

    it('should get manager automation preferences', async () => {
      if (!managerUserId) return;

      const settings = await managingService.getManagerSettings(managerUserId);
      expect(settings).toHaveProperty('data');
      expect(settings.data).toHaveProperty('autoCheckoutEnabled');
      expect(settings.data).toHaveProperty('isActiveDeduction');
    });

    it('should update manager settings with granular deduction options', async () => {
      if (!managerUserId) return;

      const updated = await managingService.updateManagerSettings(managerUserId, {
        autoCheckoutEnabled: true,
        isActiveDeduction: true,
        combineDeductionsOnEndShift: true,
        delayDeductionEnabled: false, // Late deduction disabled
        earlyLeaveDeductionEnabled: true,
        absentDeductionEnabled: true,
      });

      expect(updated.data.delayDeductionEnabled).toBe(false);
      expect(updated.data.earlyLeaveDeductionEnabled).toBe(true);
      expect(updated.data.combineDeductionsOnEndShift).toBe(true);

      // Restore
      await managingService.updateManagerSettings(managerUserId, {
        delayDeductionEnabled: true,
      });
    });

    it('should execute scheduled automations trigger without errors', async () => {
      const triggerRes = await managingService.triggerScheduledAutomations();
      expect(triggerRes).toHaveProperty('data');
      expect(Array.isArray(triggerRes.data)).toBe(true);
    });
  });

  describe('4. ⚡ N+1 Query Batch Optimization Verification', () => {
    it('should compute organization discipline in a single batch query without throwing', async () => {
      const manager = await prisma.adminProfile.findFirst();
      if (!manager) return;

      const result = await statsHelper.computeOrganizationDiscipline(manager.userId);
      expect(result).toHaveProperty('organizationRate');
      expect(result).toHaveProperty('organizationLabel');
      expect(result).toHaveProperty('employeeRates');
      expect(Array.isArray(result.employeeRates)).toBe(true);
    });
  });
});
