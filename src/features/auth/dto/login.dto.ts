import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const LoginSchema = z.object({
    email: z.email(),
    password: z.string().min(1)
})

export class LoginDto extends createZodDto(LoginSchema) {}
