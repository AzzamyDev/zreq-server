import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    UseGuards,
    Req,
    ForbiddenException
} from '@nestjs/common'
import { UsersService } from './users.service'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { JwtGuard } from 'src/config/guards/jwt.guard'
import { Request } from 'express'

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Post()
    async create(@Body() createUserDto: CreateUserDto) {
        const result = await this.usersService.create(createUserDto)
        return {
            message: 'User created successfully',
            data: result
        }
    }

    @Get()
    async findAll() {
        const result = await this.usersService.findAll()
        return {
            message: 'Get all user successfully',
            data: result
        }
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        const result = await this.usersService.findOne(+id)
        return {
            message: 'Get user successfully',
            data: result
        }
    }

    @Patch(':id')
    async update(
        @Param('id') id: string,
        @Body() updateUserDto: UpdateUserDto
    ) {
        const result = await this.usersService.update(+id, updateUserDto)
        return {
            message: 'Update user successfully',
            data: result
        }
    }

    @Patch(':id/password')
    @UseGuards(JwtGuard)
    async changePassword(@Param('id') id: string, @Req() req: Request, @Body() body: any) {
        if (req['user'].userId !== +id) throw new ForbiddenException()
        return this.usersService.changePassword(+id, body.currentPassword, body.newPassword)
    }

    @Delete(':id')
    @UseGuards(JwtGuard)
    async remove(@Param('id') id: string, @Req() req: Request) {
        if (req['user'].userId !== +id) throw new ForbiddenException()
        await this.usersService.remove(+id)

        return {
            message: 'User deleted successfully'
        }
    }
}
