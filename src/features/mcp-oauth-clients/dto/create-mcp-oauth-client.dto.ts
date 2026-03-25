import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const TokenEndpointAuthMethodSchema = z.enum(['none', 'client_secret_post', 'client_secret_basic'])

export const CreateMcpOAuthClientSchema = z.object({
    purpose: z.string().max(120).optional(),
    client_name: z.string().min(1).max(120),
    redirect_uris: z.array(z.string().min(1).max(2048)).min(1).max(20),
    token_endpoint_auth_method: TokenEndpointAuthMethodSchema
})

export class CreateMcpOAuthClientDto extends createZodDto(CreateMcpOAuthClientSchema) {}
