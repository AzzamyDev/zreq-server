import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Req,
    UseGuards
} from '@nestjs/common'
import { Request } from 'express'
import { JwtGuard } from 'src/config/guards/jwt.guard'
import { McpOAuthClientsService } from './mcp-oauth-clients.service'
import { CreateMcpOAuthClientDto } from './dto/create-mcp-oauth-client.dto'
import { UpdateMcpOAuthClientDto } from './dto/update-mcp-oauth-client.dto'

@UseGuards(JwtGuard)
@Controller('mcp-oauth-clients')
export class McpOAuthClientsController {
    constructor(private readonly svc: McpOAuthClientsService) {}

    @Get()
    async list(@Req() req: Request) {
        const data = await this.svc.list(req['user'].userId)
        return { message: 'MCP OAuth clients fetched', data }
    }

    @Post()
    async create(@Req() req: Request, @Body() dto: CreateMcpOAuthClientDto) {
        const data = await this.svc.create(req['user'].userId, dto)
        return { message: 'MCP OAuth client created', data }
    }

    @Patch(':id')
    async update(
        @Req() req: Request,
        @Param('id', ParseIntPipe) id: number,
        @Body() dto: UpdateMcpOAuthClientDto
    ) {
        const data = await this.svc.update(req['user'].userId, id, dto)
        return { message: 'MCP OAuth client updated', data }
    }

    @Delete(':id')
    async remove(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
        await this.svc.remove(req['user'].userId, id)
        return { message: 'MCP OAuth client deleted', data: null }
    }

    @Post(':id/rotate-secret')
    async rotate(@Req() req: Request, @Param('id', ParseIntPipe) id: number) {
        const data = await this.svc.rotateSecret(req['user'].userId, id)
        return { message: 'Secret rotated — store the new client_secret now', data }
    }
}
