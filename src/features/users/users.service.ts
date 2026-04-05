import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { CreateUserDto } from './dto/create-user.dto'
import { UpdateUserDto } from './dto/update-user.dto'
import { PrismaService } from 'src/config/prisma/prisma.service'

@Injectable()
export class UsersService {
    constructor(readonly prismaService: PrismaService) {}

    async create(createUserDto: CreateUserDto) {
        return this.prismaService.user.create({
            data: {
                name: createUserDto.name,
                email: createUserDto.email,
                password: createUserDto.password
            }
        })
    }

    async findAll() {
        return this.prismaService.user.findMany()
    }

    async findOne(id: number) {
        const u = await this.prismaService.user.findUniqueOrThrow({
            where: { id },
            select: {
                id: true,
                name: true,
                email: true,
                githubId: true,
                createdAt: true,
                updatedAt: true,
                password: true
            }
        })
        return {
            id: u.id,
            name: u.name,
            email: u.email,
            githubId: u.githubId,
            createdAt: u.createdAt,
            updatedAt: u.updatedAt,
            hasPassword: !!u.password
        }
    }

    async update(id: number, updateUserDto: UpdateUserDto) {
        await this.prismaService.user.findUniqueOrThrow({ where: { id } })

        return this.prismaService.user.update({
            where: { id },
            data: updateUserDto
        })
    }

    async remove(id: number) {
        await this.prismaService.user.findUniqueOrThrow({ where: { id } })

        await this.prismaService.$transaction(async (tx) => {
            await tx.collection.deleteMany({ where: { userId: id } })
            await tx.workspace.deleteMany({ where: { userId: id } })
            await tx.user.delete({ where: { id } })
        })
    }

    async changePassword(id: number, currentPassword: string | undefined, newPassword: string) {
        const user = await this.prismaService.user.findUnique({ where: { id } })
        if (!user) throw new NotFoundException()
        if (!newPassword || newPassword.length < 6) {
            throw new BadRequestException('New password must be at least 6 characters')
        }
        if (user.password) {
            if (!currentPassword) {
                throw new BadRequestException('Current password is required')
            }
            const valid = await bcrypt.compare(currentPassword, user.password)
            if (!valid) throw new BadRequestException('Current password is incorrect')
        }
        const hashed = await bcrypt.hash(newPassword, 10)
        await this.prismaService.user.update({ where: { id }, data: { password: hashed } })
        return { message: 'Password changed', hasPassword: true }
    }
}
