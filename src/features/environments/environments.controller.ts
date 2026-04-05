import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common'
import { EnvironmentsService } from './environments.service'
import { CreateEnvironmentDto } from './dto/create-environment.dto'
import { UpdateEnvironmentDto } from './dto/update-environment.dto'
import { JwtGuard } from 'src/config/guards/jwt.guard'
import { Request } from 'express'

@UseGuards(JwtGuard)
@Controller('environments')
export class EnvironmentsController {
    constructor(private readonly environmentsService: EnvironmentsService) {}

    @Get()
    async findAll(@Req() req: Request, @Query('workspaceId') workspaceId?: string) {
        const ws = workspaceId != null && workspaceId !== '' ? +workspaceId : undefined
        const result = await this.environmentsService.findAll(req['user'].userId, ws)
        return { message: 'Environments fetched successfully', data: result }
    }

    @Get(':id')
    async findOne(@Param('id') id: string, @Req() req: Request) {
        const result = await this.environmentsService.findOne(+id, req['user'].userId)
        return { message: 'Environment fetched successfully', data: result }
    }

    @Post()
    async create(@Body() dto: CreateEnvironmentDto, @Req() req: Request) {
        const result = await this.environmentsService.create(dto, req['user'].userId)
        return { message: 'Environment created successfully', data: result }
    }

    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateEnvironmentDto,
        @Req() req: Request
    ) {
        const result = await this.environmentsService.update(+id, dto, req['user'].userId)
        return { message: 'Environment updated successfully', data: result }
    }

    @Delete(':id')
    async remove(@Param('id') id: string, @Req() req: Request) {
        await this.environmentsService.remove(+id, req['user'].userId)
        return { message: 'Environment deleted successfully' }
    }
}
