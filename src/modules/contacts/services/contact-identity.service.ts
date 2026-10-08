import type {ContactIdentityDto,} from '../dto/contact.dto';
import {ContactIdentityMapper,} from '../mappers/contact-identity.mapper';
import type {ContactRepository,} from '../repositories/contact.repository';
import type {ContactIdentityRepository,} from '../repositories/contact-identity.repository';
import type {CreateContactIdentityInput,} from '../types/contact-identity.types';

export class ContactNotFoundError
extends Error {
    constructor() {
        super('Contact not found',);
        this.name = 'ContactNotFoundError';
    }
}

export class DuplicateContactIdentityError
extends Error {
    constructor() {
        super('This contact identity already exists',);
        this.name = 'DuplicateContactIdentityError';
    }
}

export class ContactIdentityService {
    constructor(
        private readonly contactRepository: ContactRepository,
        private readonly identityRepository: ContactIdentityRepository,
    ) {}

    async create(input: CreateContactIdentityInput,): Promise<ContactIdentityDto> { 
        const contactExists =
            await this.contactRepository.exists(
                input.organizationId,
                input.contactId,
            );

        if (!contactExists) {
            throw new ContactNotFoundError();
        } 
        const existingIdentity =
            await this.identityRepository
                .findByChannelAndExternalId(
                    input.organizationId,
                    input.channel,
                    input.externalId,
                );

        if (existingIdentity) {
            throw new DuplicateContactIdentityError();
        }

        const identity = await this.identityRepository.create(input,);
        return ContactIdentityMapper.toDto(identity,);
    }
}