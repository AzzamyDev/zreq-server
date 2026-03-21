import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const CreateUserSchema = z.object({
    name: z.string(),
    email: z.email(),
    password: z.string()
})

export class CreateUserDto extends createZodDto(CreateUserSchema) {}
