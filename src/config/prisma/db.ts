import { PoolConfig } from 'mariadb'

export function getConnectionConfig(url: string): PoolConfig {
    if (!url) throw new Error('DATABASE_URL is not set')

    // Parse the DATABASE_URL to extract connection parameters
    const match = url.match(/^mysql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/)
    if (!match) throw new Error('DATABASE_URL format is invalid')

    const [, user, password, host, portStr, database] = match
    const port = Number(portStr)
    return {
        host,
        port,
        database,
        user,
        password,
        connectionLimit: 10,
        allowPublicKeyRetrieval: true
    }
}
