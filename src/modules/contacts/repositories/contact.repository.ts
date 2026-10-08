import type {
    ContactStatus,
} from '../../../../generated/prisma/client';

import type {
    ContactListQuery,
    CreateContactIdentityInput,
    CreateContactInput,
} from '../types/contact.types';


export interface ContactRepository {

    findMany(query: ContactListQuery): Promise<{
        contacts: unknown[];
        total: number;
    }>;

    findById(organizationId: string,contactId: string): Promise<unknown | null>;

    create(input: CreateContactInput): Promise<unknown>;

    findByPhone(organizationId: string,phone: string): Promise<unknown | null>;

    findByEmail(organizationId: string,email: string): Promise<unknown | null>;

    identityExists(organizationId: string,channel: string,externalId: string): Promise<boolean>;

    createIdentity(input: CreateContactIdentityInput): Promise<unknown>;
    
    exists(organizationId: string,contactId: string): Promise<boolean>;
}