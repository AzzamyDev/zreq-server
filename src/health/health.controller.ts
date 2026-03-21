import { Controller, Get } from '@nestjs/common'

/** Public probe so the client can verify a URL is this API before saving an instance. */
@Controller()
export class HealthController {
    @Get('health')
    health() {
        return { ok: true as const, service: 'zreq-api' as const }
    }
}
