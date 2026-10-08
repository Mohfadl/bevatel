import {Prisma} from '../../../../generated/prisma/client';
import prisma from '../../../../shared/prisma';
import type {ContactRepository} from './contact.repository';
import type {
    ContactListQuery,
    CreateContactIdentityInput,
    CreateContactInput,
} from '../types/contact.types';


const contactListInclude = { identities: true} satisfies Prisma.ContactInclude;
const contactDetailsInclude = {
    identities: true,
    conversations: {
        orderBy: {
            createdAt: 'desc' as const,
        },
        take: 20,
    },
} satisfies Prisma.ContactInclude;


export class PrismaContactRepository implements ContactRepository {

    async findMany(query: ContactListQuery): Promise<{contacts: unknown[];total: number;}> {
        const where = this.buildWhere(query);
        const orderBy = this.buildOrderBy(query.sort);
        const [total,contacts] =
            await prisma.$transaction([
                prisma.contact.count({where}),
                prisma.contact.findMany({
                    where,
                    include: contactListInclude,
                    orderBy,
                    skip: (query.page - 1) * query.perPage,
                    take: query.perPage,
                }),
            ]);
        return {contacts, total};
    }

    async findById(organizationId: string,contactId: string,): Promise<unknown | null> {
        return prisma.contact.findFirst({
            where: {
                id: contactId,
                organizationId,
            },
            include: contactDetailsInclude,
        });
    }

    async create(input: CreateContactInput): Promise<unknown> {
        return prisma.contact.create({
            data: {
                organizationId: input.organizationId,
                displayName: input.displayName,
                firstName: input.firstName ?? null,
                lastName: input.lastName ?? null,
                email: input.email ?? null,
                phone: input.phone ?? null,
                company: input.company ?? null,
                bio: input.bio ?? null,
                attributes: input.attributes ? (input.attributes as Prisma.InputJsonValue) : undefined,
                status: input.status ?? 'ACTIVE',
            },
            include: contactListInclude,
        });
    }


    async findByPhone(organizationId: string,phone: string): Promise<unknown | null> {
        return prisma.contact.findFirst({
            where: {
                organizationId,
                phone,
            },
            select: {id: true},
        });
    }

    async findByEmail(organizationId: string,email: string): Promise<unknown | null> {
        return prisma.contact.findFirst({
            where: {
                organizationId,
                email,
            },
            select: {id: true},
        });
    }

    async identityExists(organizationId: string,channel: string,externalId: string): Promise<boolean> {
        const identity =
            await prisma.contactIdentity.findFirst({
                where: {
                    organizationId,
                    channel: channel as any,
                    externalId,
                },
                select: {id: true},
            });
        return Boolean(identity);
    }

    async createIdentity(input: CreateContactIdentityInput): Promise<unknown> {
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

    async exists(organizationId: string,contactId: string): Promise<boolean> {

        const contact = await prisma.contact.findFirst({
                where: {
                    id: contactId,
                    organizationId,
                },
                select: {id: true},
            });
        return Boolean(contact);
    }

    private buildWhere(query: ContactListQuery): Prisma.ContactWhereInput {
        const where: Prisma.ContactWhereInput = { organizationId: query.organizationId};
        if (query.status) {
            where.status = query.status;
        }
        if (query.search) {
            where.OR = [
                {displayName: {contains: query.search,},},
                {firstName: {contains: query.search,},},
                {lastName: {contains: query.search,},},
                {email: {contains: query.search,},},
                {phone: {contains: query.search,},},
                {company: { contains: query.search,},},
            ];
        }
        return where;
    }

    private buildOrderBy(sort: ContactListQuery['sort']): Prisma.ContactOrderByWithRelationInput {
        switch (sort) {
            case 'oldest': return { createdAt: 'asc'};
            case 'name_asc': return { displayName: 'asc'};
            case 'name_desc': return { displayName:'desc'};
            case 'newest':
            default: return { createdAt: 'desc'};
        }
    }
}