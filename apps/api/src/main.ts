import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import helmet from 'helmet'
import { readEnv } from '@chainlens/config'
import { AppModule } from './app.module'
import { ApiExceptionFilter } from './filter'

async function bootstrap() {
  const env = readEnv()
  const app = await NestFactory.create(AppModule)
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      contentSecurityPolicy: false,
      strictTransportSecurity: false,
    }),
  )
  app.use((req: { url?: string }, _res: unknown, next: () => void) => {
    if (req.url === '/v1' || req.url?.startsWith('/v1/') || req.url?.startsWith('/v1?')) {
      req.url = `/api${req.url}`
    }
    next()
  })
  app.enableCors({ origin: env.WEB_ORIGIN.split(',').map((origin) => origin.trim()), allowedHeaders: ['content-type', 'authorization'] })
  app.useGlobalFilters(new ApiExceptionFilter())
  await app.listen(env.API_PORT)
}

void bootstrap()
