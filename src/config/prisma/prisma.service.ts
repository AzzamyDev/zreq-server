import 'dotenv/config'
import { Injectable } from '@nestjs/common'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '@prisma/generated/client'
import { getConnectionConfig } from './db'

@Injectable()
export class PrismaService extends PrismaClient {
    constructor() {
        const url = process.env.DATABASE_URL
        if (!url) throw new Error('DATABASE_URL is not set')
        const connectionConfig = getConnectionConfig(url)
        super({
            adapter: new PrismaMariaDb({
                ...connectionConfig
            })
        })
    }
}
