import type {ChannelType,} from '../../../../generated/prisma/client';

export interface CreateContactIdentityInput {
    organizationId: string;
    contactId: string;
    channel: ChannelType;
    externalId: string;
    username?: string | null;
    phone?: string | null;
    email?: string | null;
    metadata?: Record<string, unknown> | null;
}