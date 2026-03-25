import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { TokenEndpointAuthMethodSchema } from './create-mcp-oauth-client.dto'

export const UpdateMcpOAuthClientSchema = z
    .object({
        purpose: z.union([z.string().max(120), z.null()]).optional(),
        client_name: z.string().min(1).max(120).optional(),
        redirect_uris: z.array(z.string().min(1).max(2048)).min(1).max(20).optional(),
        token_endpoint_auth_method: TokenEndpointAuthMethodSchema.optional()
    })
    .superRefine((val, ctx) => {
        if (
            val.purpose === undefined &&
            val.client_name === undefined &&
            val.redirect_uris === undefined &&
            val.token_endpoint_auth_method === undefined
        ) {
            ctx.addIssue({ code: 'custom', message: 'At least one field is required' })
        }
    })

export class UpdateMcpOAuthClientDto extends createZodDto(UpdateMcpOAuthClientSchema) {}
