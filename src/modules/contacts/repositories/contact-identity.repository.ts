import type {ChannelType,} from '../../../../generated/prisma/client';
import type {CreateContactIdentityInput,} from '../types/contact-identity.types';

export interface ContactIdentityRepository {
    findByChannelAndExternalId(
        organizationId: string,
        channel: ChannelType,
        externalId: string,
    ): Promise<unknown | null>;

    create(input: CreateContactIdentityInput,): Promise<unknown>;
}