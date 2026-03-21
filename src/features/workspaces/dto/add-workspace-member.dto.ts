import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const AddWorkspaceMemberSchema = z.object({
    email: z.email()
})

export class AddWorkspaceMemberDto extends createZodDto(AddWorkspaceMemberSchema) {}
