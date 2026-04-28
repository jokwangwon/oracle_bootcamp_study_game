import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { applySecurityMiddleware } from './security/security-middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // ADR-020 §4.1 PR-3a — helmet 보안 헤더 (HSTS production-only).
  applySecurityMiddleware(app);

  // ADR-020 §4.2.1 — JwtStrategy 의 cookie extractor 가 req.cookies 사용.
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS origin 은 "브라우저가 오는 곳" (web 의 URL). `NEXT_PUBLIC_API_URL` 은 api
  // 자신의 URL 이므로 여기 쓰면 안 됨 (2026-04-23 수정).
  // 복수 origin 지원 — comma 로 구분 (예: "http://localhost:3000,http://100.102.41.122:3002").
  const corsOrigin = (process.env.CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);

  // eslint-disable-next-line no-console
  console.log(`[oracle-game-api] listening on port ${port}`);
}

bootstrap();
