import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const UpdateCollectionSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    auth: z.record(z.string(), z.any()).optional(),
    variables: z.array(z.any()).optional(),
    items: z.array(z.any()).optional(),
    expectedUpdatedAt: z.string().optional(),
    force: z.boolean().optional()
})

export class UpdateCollectionDto extends createZodDto(UpdateCollectionSchema) {}
