import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

const VariableSchema = z.object({
    key: z.string(),
    value: z.string(),
    enabled: z.boolean().default(true)
})

export const CreateEnvironmentSchema = z.object({
    name: z.string().min(1),
    workspaceId: z.number().int().positive(),
    variables: z.array(VariableSchema).optional().default([])
})

export class CreateEnvironmentDto extends createZodDto(CreateEnvironmentSchema) {}
