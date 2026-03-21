import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const UpdateWorkspaceSchema = z.object({
    name: z.string().min(1).max(120).optional(),
    expectedUpdatedAt: z.string().optional(),
    force: z.boolean().optional()
})

export class UpdateWorkspaceDto extends createZodDto(UpdateWorkspaceSchema) {}
