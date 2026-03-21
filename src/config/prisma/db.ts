import { PoolConfig } from 'mariadb'

export function getConnectionConfig(url: string): PoolConfig {
    if (!url) throw new Error('DATABASE_URL is not set')

    let match: RegExpMatchArray | null = null;
    try {
        const parsed = new URL(url);
        const decodedPassword = decodeURIComponent(parsed.password);
        if (parsed.protocol !== 'mysql:') throw new Error();
        match = [
            '', // full match placeholder (not used)
            parsed.username,
            decodedPassword,
            parsed.hostname,
            parsed.port,
            parsed.pathname.replace(/^\//, ''),
        ];
    } catch {
        throw new Error('DATABASE_URL format is invalid');
    }

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
