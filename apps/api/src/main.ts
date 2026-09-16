import './load-env';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { startThunderTracing } from './thunder-core/observability/tracing-bootstrap';

async function bootstrap() {
  await startThunderTracing();

  const app = await NestFactory.create(AppModule, { rawBody: true });
  app.enableShutdownHooks();
  app.use(cookieParser());
  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      const ok = /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin);
      callback(null, ok);
    },
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Authority-Company-Id',
      'X-Authority-Site-Id',
      'X-Correlation-Id',
    ],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const port = Number(process.env.API_PORT ?? 3001);

  try {
    await app.listen(port);
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'EADDRINUSE'
    ) {
      throw new Error(
        `Port ${port} déjà utilisé. Arrêtez l'autre instance (npm run stop:api) ou changez API_PORT dans .env.`,
        { cause: error },
      );
    }
    throw error;
  }
}

void bootstrap();
