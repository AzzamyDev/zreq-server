import 'dotenv/config'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '@prisma/generated/client'
import { getConnectionConfig } from '../src/config/prisma/db'

const OLD_URI = 'cursor://anysphere.cursor-mcp/oauth/callback'
const NEW_URI = 'http://localhost:8787/callback'

async function main() {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set')

    const prisma = new PrismaClient({
        adapter: new PrismaMariaDb(getConnectionConfig(url))
    })

    const rows = await prisma.oAuthClientStore.findMany({
        select: { id: true, clientId: true, redirectUris: true }
    })

    const targets = rows.filter((row) => {
        if (row.clientId.startsWith('zreqmcpcursor_')) return true
        const uris = Array.isArray(row.redirectUris) ? row.redirectUris.map(String) : []
        return uris.includes(OLD_URI)
    })

    if (targets.length === 0) {
        console.log('No Cursor MCP OAuth clients to update')
        await prisma.$disconnect()
        return
    }

    for (const client of targets) {
        const uris = Array.isArray(client.redirectUris) ? client.redirectUris.map(String) : []
        if (uris.length === 1 && uris[0] === NEW_URI) {
            console.log(`Already up to date: ${client.clientId}`)
            continue
        }

        await prisma.oAuthClientStore.update({
            where: { id: client.id },
            data: { redirectUris: [NEW_URI] }
        })
        console.log(`Updated ${client.clientId} from ${JSON.stringify(uris)} to ${JSON.stringify([NEW_URI])}`)
    }

    await prisma.$disconnect()
}

main().catch((e) => {
    console.error(e)
    process.exit(1)
})
