import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const CreateCollectionSchema = z.object({
    name: z.string().min(1),
    items: z.array(z.any()).optional(),
    workspaceId: z.number().int().positive().optional()
})

export class CreateCollectionDto extends createZodDto(CreateCollectionSchema) {}
