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
        return this.prismaService.user.findUniqueOrThrow({ where: { id } })
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
            await tx.environment.deleteMany({ where: { userId: id } })
            await tx.user.delete({ where: { id } })
        })
    }

    async changePassword(id: number, currentPassword: string, newPassword: string) {
        const user = await this.prismaService.user.findUnique({ where: { id } })
        if (!user) throw new NotFoundException()
        if (!user.password) {
            throw new BadRequestException('No password on file; sign in with GitHub or set one via recovery')
        }
        const valid = await bcrypt.compare(currentPassword, user.password)
        if (!valid) throw new BadRequestException('Current password is incorrect')
        const hashed = await bcrypt.hash(newPassword, 10)
        await this.prismaService.user.update({ where: { id }, data: { password: hashed } })
        return { message: 'Password changed' }
    }
}
