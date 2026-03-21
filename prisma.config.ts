import path from 'node:path'
import { defineConfig } from 'prisma/config'
import 'dotenv/config'

export default defineConfig({
    schema: path.join('prisma', 'schema.prisma'),
    migrations: {
        path: path.join('prisma', 'migrations'),
        seed: "npx tsx prisma/seed.ts",
    },
    datasource: {
        url: process.env.DATABASE_URL ?? ''
    }
})
