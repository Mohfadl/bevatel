import type {
    ContactListResponseDto,
    ContactDto,
    ContactIdentityDto,
} from '../dto/contact.dto';

import type {ContactQueryDto,} from '../dto/contact-query.dto';
import type {ContactRepository,} from '../repositories/contact.repository';
import {ContactMapper,} from '../mappers/contact.mapper';
import type {
    CreateContactIdentityInput,
    CreateContactInput,
} from '../types/contact.types';

export class ContactNotFoundError
extends Error {
    constructor() {
        super('Contact not found',);
        this.name = 'ContactNotFoundError';
    }
}

export class DuplicateContactPhoneError
extends Error {
    constructor() {
        super('A contact with this phone number already exists',);
        this.name = 'DuplicateContactPhoneError';
    }
}

export class DuplicateContactEmailError
extends Error {
    constructor() {
        super('A contact with this email already exists',);
        this.name = 'DuplicateContactEmailError';
    }
}

export class DuplicateContactIdentityError
extends Error {
    constructor() {
        super('This contact identity already exists',);
        this.name = 'DuplicateContactIdentityError';
    }
}

export class ContactService { constructor( private readonly contactRepository: ContactRepository) {}

    async list(organizationId: string,query: ContactQueryDto,): Promise<ContactListResponseDto> {
        const result =
            await this.contactRepository.findMany({
                organizationId,
                search: query.search,
                status: query.status,
                sort: query.sort,
                page: query.page,
                perPage: query.perPage,
            });

        return {
            contacts: ContactMapper.toCollection(result.contacts,),
            pagination: {
                page: query.page,
                perPage: query.perPage,
                total: result.total,
                totalPages: Math.ceil(result.total /query.perPage),
            },
        };
    }

    async getById(organizationId: string,contactId: string): Promise<ContactDto> {

        const contact = 
            await this.contactRepository.findById(
                organizationId,
                contactId,
            );

        if (!contact) {
            throw new ContactNotFoundError();
        }
        return ContactMapper.toDto(contact);
    }


    async create(input: CreateContactInput): Promise<ContactDto> {
        if (input.phone) {
            const existingPhone =
                await this.contactRepository.findByPhone(
                    input.organizationId,
                    input.phone,
                );

            if (existingPhone) {
                throw new DuplicateContactPhoneError();
            }
        }

        if (input.email) {
            const existingEmail = 
                await this.contactRepository.findByEmail(
                    input.organizationId,
                    input.email,
                );

            if (existingEmail) {
                throw new DuplicateContactEmailError();
            }
        }

        const contact = await this.contactRepository.create(input,);
        return ContactMapper.toDto(contact,);
    }


    async createIdentity(input: CreateContactIdentityInput,): Promise<ContactIdentityDto> {
        const contactExists =
            await this.contactRepository.exists(
                input.organizationId,
                input.contactId,
            );

        if (!contactExists) {
            throw new ContactNotFoundError();
        }

        const identityExists =
            await this.contactRepository.identityExists(
                input.organizationId,
                input.channel,
                input.externalId,
            );

        if (identityExists) {
            throw new DuplicateContactIdentityError();
        }

        const identity = await this.contactRepository.createIdentity(input,);
        return ContactMapper.identityToDto(identity,);
    }
}