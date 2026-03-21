import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'
import { NotFoundExceptionFilter } from './config/exception/NotFoundExceptionFilter'
import { NestExpressApplication } from '@nestjs/platform-express'
import { json, urlencoded } from 'express'

/** Default express.json() limit is 100kb; large Postman imports exceed it (413). */
const BODY_LIMIT = process.env.BODY_LIMIT || '50mb'

const PORT = process.env.PORT || 3000

async function bootstrap() {
    const app = await NestFactory.create<NestExpressApplication>(AppModule)
    app.use(json({ limit: BODY_LIMIT }))
    app.use(urlencoded({ extended: true, limit: BODY_LIMIT }))

    app.enableCors({
        origin: '*'
    })

    app.useGlobalFilters(new NotFoundExceptionFilter())
    // app.setGlobalPrefix('api')
    await app.listen(PORT)
}
bootstrap()
