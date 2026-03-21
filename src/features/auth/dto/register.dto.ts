import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const RegisterSchema = z.object({
    name: z.string().min(1),
    email: z.email(),
    password: z.string().min(6)
})

export class RegisterDto extends createZodDto(RegisterSchema) {}
