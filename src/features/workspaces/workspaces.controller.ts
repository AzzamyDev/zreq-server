import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common'
import { WorkspacesService } from './workspaces.service'
import { CreateWorkspaceDto } from './dto/create-workspace.dto'
import { UpdateWorkspaceDto } from './dto/update-workspace.dto'
import { AddWorkspaceMemberDto } from './dto/add-workspace-member.dto'
import { JwtGuard } from 'src/config/guards/jwt.guard'
import { Request } from 'express'

@UseGuards(JwtGuard)
@Controller('workspaces')
export class WorkspacesController {
    constructor(private readonly workspacesService: WorkspacesService) {}

    @Get()
    async findAll(@Req() req: Request) {
        const data = await this.workspacesService.findAll(req['user'].userId)
        return { message: 'Workspaces fetched successfully', data }
    }

    @Post()
    async create(@Body() dto: CreateWorkspaceDto, @Req() req: Request) {
        const data = await this.workspacesService.create(req['user'].userId, dto)
        return { message: 'Workspace created successfully', data }
    }

    @Get(':id/members')
    async listMembers(@Param('id') id: string, @Req() req: Request) {
        const data = await this.workspacesService.listMembers(+id, req['user'].userId)
        return { message: 'Workspace members fetched successfully', data }
    }

    @Post(':id/members')
    async addMember(@Param('id') id: string, @Body() dto: AddWorkspaceMemberDto, @Req() req: Request) {
        const data = await this.workspacesService.addMember(+id, req['user'].userId, dto.email)
        return { message: 'Member added successfully', data }
    }

    @Delete(':id/members/:memberUserId')
    async removeMember(
        @Param('id') id: string,
        @Param('memberUserId') memberUserId: string,
        @Req() req: Request
    ) {
        await this.workspacesService.removeMember(+id, req['user'].userId, +memberUserId)
        return { message: 'Member removed successfully' }
    }

    @Patch(':id')
    async update(@Param('id') id: string, @Body() dto: UpdateWorkspaceDto, @Req() req: Request) {
        const data = await this.workspacesService.update(+id, req['user'].userId, dto)
        return { message: 'Workspace updated successfully', data }
    }

    @Delete(':id')
    async remove(@Param('id') id: string, @Req() req: Request) {
        await this.workspacesService.remove(+id, req['user'].userId)
        return { message: 'Workspace deleted successfully' }
    }
}
