import 'reflect-metadata'

import { ValidationPipe } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  // Validate/whitelist all incoming request bodies against their DTOs.
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))
  // Let Nest run onModuleDestroy (e.g. Prisma $disconnect) on SIGINT/SIGTERM.
  app.enableShutdownHooks()
  const port = process.env.PORT ?? 3000
  await app.listen(port)
  // eslint-disable-next-line no-console
  console.log(`API listening on http://localhost:${port}`)
}

void bootstrap()
