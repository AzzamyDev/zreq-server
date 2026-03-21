import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from './generated/client';
import { getConnectionConfig } from '../src/config/prisma/db';

const prisma = new PrismaClient({
    adapter: new PrismaMariaDb(getConnectionConfig(process.env.DATABASE_URL ?? ''))
})

async function main() {
    /* 
    Add your seed data here
    */
}
main()
    .then(async () => {
        await prisma.$disconnect()
    })
    .catch(async (e) => {
        console.error(e)
        await prisma.$disconnect()
        process.exit(1)
    })
