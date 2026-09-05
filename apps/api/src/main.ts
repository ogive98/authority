import './load-env';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { startThunderTracing } from './thunder-core/observability/tracing-bootstrap';

async function bootstrap() {
  await startThunderTracing();

  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  app.use(cookieParser());
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
