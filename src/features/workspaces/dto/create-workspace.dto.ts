import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const CreateWorkspaceSchema = z.object({
    name: z.string().min(1).max(120)
})

export class CreateWorkspaceDto extends createZodDto(CreateWorkspaceSchema) {}
