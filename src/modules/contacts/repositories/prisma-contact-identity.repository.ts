import {Prisma,} from '../../../../generated/prisma/client';
import prisma from '../../../../shared/prisma';
import type {ContactIdentityRepository,} from './contact-identity.repository';
import type {CreateContactIdentityInput,} from '../types/contact-identity.types';

export class PrismaContactIdentityRepository implements ContactIdentityRepository {
    async findByChannelAndExternalId(
        organizationId: string,
        channel: CreateContactIdentityInput['channel'],
        externalId: string,
    ): Promise<unknown | null> {

        return prisma.contactIdentity.findFirst({
            where: {
                organizationId,
                channel,
                externalId,
            },
            select: {
                id: true,
                contactId: true,
                channel: true,
                externalId: true,
            },
        });
    }

    async create(input: CreateContactIdentityInput,): Promise<unknown> {
        return prisma.contactIdentity.create({
            data: {
                organizationId: input.organizationId,
                contactId: input.contactId,
                channel: input.channel,
                externalId: input.externalId,
                username: input.username ?? null,
                phone: input.phone ?? null,
                email: input.email ?? null,
                metadata: input.metadata ? (input.metadata as Prisma.InputJsonValue) : undefined,
            },
        });
    }
}