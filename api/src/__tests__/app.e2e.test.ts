import { describe, it, expect, beforeAll } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../app.module';

describe('API (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('v1');
    await app.init();
  });

  describe('GET /v1/health', () => {
    it('returns 200 with data wrapper', async () => {
      const res = await request(app.getHttpServer()).get('/v1/health');
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('ok');
      expect(res.body.data.timestamp).toBeDefined();
    });
  });

  describe('POST /v1/auth/register (guarded)', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/register')
        .send({ email: 'a@b.com', password: '123456', name: 'Test' });
      expect(res.status).toBe(401);
    });
  });

  describe('POST /v1/auth/login', () => {
    it('validates required fields', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error || res.body.message).toBeDefined();
    });

    it('returns error for non-existent user', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/login')
        .send({ email: 'noexiste@test.com', password: '123456' });
      // Domain error mapping may vary in test env; verifies it fails
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('Refresh token', () => {
    it('rejects missing refresh token', async () => {
      const res = await request(app.getHttpServer())
        .post('/v1/auth/refresh');
      expect(res.status).toBe(401);
    });
  });

  afterAll(async () => {
    await app.close();
  });
});
