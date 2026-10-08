import {z,} from 'zod';

import {
    ChannelType,
    ContactStatus,
} from '../../../../generated/prisma/client';

const optionalNullableString = (maxLength: number,) => z.string().trim().max(maxLength).optional().nullable();
export const contactListQuerySchema =
    z.object({
        search: z.string().trim().max(255).optional(),
        status: z.nativeEnum(ContactStatus).optional(),
        sort: z.enum(['newest','oldest','name_asc','name_desc']).default('newest'),
        page: z.coerce.number().int().positive().default(1),

        perPage: z.coerce.number().int().positive().max(100).default(20),
    });

export const contactIdParamsSchema = z.object({id: z.string().uuid()});
export const createContactSchema =
    z.object({
        displayName: z.string().trim().min(1,'Display name is required',).max(150),
        firstName: optionalNullableString(100,),
        lastName: optionalNullableString(100,),
        email: z.string().trim().email().optional().nullable(),
        phone: optionalNullableString(50,),
        company: optionalNullableString(150,),
        bio: z.string().trim().optional().nullable(),
        attributes: z.record(z.string(),z.unknown(),).optional().nullable(),
        status: z.nativeEnum(ContactStatus,).optional(),
    });
export const createContactIdentitySchema =
    z.object({
        channel: z.nativeEnum(ChannelType,),
        externalId: z.string().trim().min(1,'External ID is required',),
        username: z.string().trim().optional().nullable(),
        phone: z.string().trim().optional().nullable(),
        email: z.string().trim().email().optional().nullable(),
        metadata: z.record(z.string(),z.unknown(),).optional().nullable(),
    });

export type ContactListQueryInput = z.infer<typeof contactListQuerySchema>;
export type CreateContactBody = z.infer<typeof createContactSchema>;
export type CreateContactIdentityBody = z.infer<typeof createContactIdentitySchema>;