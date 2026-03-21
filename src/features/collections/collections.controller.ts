import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req, Query } from '@nestjs/common'
import { CollectionsService } from './collections.service'
import { CreateCollectionDto } from './dto/create-collection.dto'
import { UpdateCollectionDto } from './dto/update-collection.dto'
import { JwtGuard } from 'src/config/guards/jwt.guard'
import { Request } from 'express'

@UseGuards(JwtGuard)
@Controller('collections')
export class CollectionsController {
    constructor(private readonly collectionsService: CollectionsService) {}

    @Get()
    async findAll(@Req() req: Request, @Query('workspaceId') workspaceId?: string) {
        const ws = workspaceId != null && workspaceId !== '' ? +workspaceId : undefined
        const result = await this.collectionsService.findAll(req['user'].userId, ws)
        return { message: 'Collections fetched successfully', data: result }
    }

    @Get(':id')
    async findOne(@Param('id') id: string, @Req() req: Request) {
        const result = await this.collectionsService.findOne(+id, req['user'].userId)
        return { message: 'Collection fetched successfully', data: result }
    }

    @Post()
    async create(@Body() dto: CreateCollectionDto, @Req() req: Request) {
        const result = await this.collectionsService.create(dto, req['user'].userId)
        return { message: 'Collection created successfully', data: result }
    }

    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() dto: UpdateCollectionDto,
        @Req() req: Request
    ) {
        const result = await this.collectionsService.update(+id, dto, req['user'].userId)
        return { message: 'Collection updated successfully', data: result }
    }

    @Delete(':id')
    async remove(@Param('id') id: string, @Req() req: Request) {
        await this.collectionsService.remove(+id, req['user'].userId)
        return { message: 'Collection deleted successfully' }
    }
}
