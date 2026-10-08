import type {
    ChannelType,
    ContactStatus,
} from '../../../../generated/prisma/client';


export type ContactSort =
    | 'newest'
    | 'oldest'
    | 'name_asc'
    | 'name_desc';

export interface ContactListQuery {
    organizationId: string;
    search?: string;
    status?: ContactStatus;
    sort: ContactSort;
    page: number;
    perPage: number;
}

export interface CreateContactInput {
    organizationId: string;
    displayName: string;
    firstName?: string | null;
    lastName?: string | null;
    email?: string | null;
    phone?: string | null;
    company?: string | null;
    bio?: string | null;
    attributes?: Record<string, unknown> | null;
    status?: ContactStatus;
}

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

export interface ContactPagination {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
}