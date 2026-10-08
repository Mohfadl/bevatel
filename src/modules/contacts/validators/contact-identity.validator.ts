import {z,} from 'zod';
import {ChannelType,} from '../../../../generated/prisma/client';
export const createContactIdentitySchema =
    z.object({
        channel: z.nativeEnum(ChannelType,),
        externalId: z.string().trim().min(1,'External ID is required',),
        username: z.string().trim().optional().nullable(),
        phone: z.string().trim().optional().nullable(),
        email: z.string().trim().email().optional().nullable(),
        metadata: z.record(z.string(),z.unknown(),).optional().nullable(),
    });
export type CreateContactIdentityBody = z.infer<typeof createContactIdentitySchema>;