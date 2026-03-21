import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const VariableSchema = z.object({
    key: z.string(),
    value: z.string(),
    enabled: z.boolean().default(true)
})

export const UpdateEnvironmentSchema = z.object({
    name: z.string().min(1).optional(),
    variables: z.array(VariableSchema).optional(),
    expectedUpdatedAt: z.string().optional(),
    force: z.boolean().optional()
})

export class UpdateEnvironmentDto extends createZodDto(UpdateEnvironmentSchema) {}
