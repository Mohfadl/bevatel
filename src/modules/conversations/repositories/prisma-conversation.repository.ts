import {
    Prisma,
    type ConversationPriority,
    type ConversationStatus,
} from '../../../../generated/prisma/client';

import prisma from '../../../../shared/prisma';

import type {ConversationRepository} from './conversation.repository';
import type {ConversationListQuery} from '../types/conversation.types';

const conversationListInclude = {
    contact: true,
    channelAccount: {
        select: {
            id: true,
            channel: true,
            name: true,
            externalAccountId: true,
            phoneNumberId: true,
            pageId: true,
            instagramAccountId: true,
        },
    },

    assignedUser: {
        select: {
            id: true,
            name: true,
            email: true,
        },
    },

    messages: {
        orderBy: {
            createdAt: 'desc' as const,
        },
        take: 1,
    },

    labels: {
        include: { label: true},
    },
} satisfies Prisma.ConversationInclude;


const conversationDetailsInclude = {
    contact: true,
    channelAccount: {
        select: {
            id: true,
            channel: true,
            name: true,
            externalAccountId: true,
            phoneNumberId: true,
            pageId: true,
            instagramAccountId: true,
        },
    },

    assignedUser: {
        select: {
            id: true,
            name: true,
            email: true,
        },
    },

    messages: {
        orderBy: {
            createdAt: 'asc' as const,
        },
    },

    labels: {
        include: {
            label: true,
        },
    },
} satisfies Prisma.ConversationInclude;


export class PrismaConversationRepository implements ConversationRepository {

    async findMany(query: ConversationListQuery): Promise<{conversations: unknown[]; total: number;}> {
        const where = this.buildWhere(query);
        const skip = (query.page - 1) * query.limit;
        const orderBy: Prisma.ConversationOrderByWithRelationInput = query.sort === 'oldest' ? { lastMessageAt: 'asc'} : { lastMessageAt: 'desc'};
        const [conversations,total] =
            await prisma.$transaction([
                prisma.conversation.findMany({
                    where,
                    include: conversationListInclude,
                    orderBy,
                    skip,
                    take: query.limit,
                }),
                prisma.conversation.count({where}),
            ]);
        return {conversations,total};
    }


    async findById(
        organizationId: string,
        conversationId: string,
    ): Promise<unknown | null> {
        return prisma.conversation.findFirst({
            where: {
                id: conversationId,
                organizationId,
            },
            include: conversationDetailsInclude,
        });
    }

    async updateStatus(
        organizationId: string,
        conversationId: string,
        status: ConversationStatus,
    ): Promise<unknown> {

        const data: Prisma.ConversationUpdateInput = {status};
        if (status === 'RESOLVED') {
            data.resolvedAt = new Date();
        } else {
            data.resolvedAt = null;
        }

        if (status === 'CLOSED') {
            data.closedAt = new Date();
        } else {
            data.closedAt = null;
        }

        await prisma.conversation.updateMany({
            where: {id: conversationId, organizationId},
            data,
        });
        return this.findById(organizationId,conversationId);
    }

    async updateAssignment(
        organizationId: string,
        conversationId: string,
        assignedUserId: string | null,
    ): Promise<unknown> {

        await prisma.conversation.updateMany({
            where: {
                id: conversationId,
                organizationId,
            },
            data: { assignedUserId},
        });


        return this.findById(
            organizationId,
            conversationId,
        );
    }


    async updatePriority(
        organizationId: string,
        conversationId: string,
        priority: ConversationPriority,
    ): Promise<unknown> {

        await prisma.conversation.updateMany({
            where: {
                id: conversationId,
                organizationId,
            },

            data: {
                priority,
            },
        });


        return this.findById(
            organizationId,
            conversationId,
        );
    }


    async exists(
        organizationId: string,
        conversationId: string,
    ): Promise<boolean> {

        const conversation =
            await prisma.conversation.findFirst({
                where: {
                    id: conversationId,
                    organizationId,
                },

                select: {
                    id: true,
                },
            });


        return Boolean(
            conversation,
        );
    }


    private buildWhere(
        query: ConversationListQuery,
    ): Prisma.ConversationWhereInput {

        const where:
            Prisma.ConversationWhereInput = {
                organizationId:
                    query.organizationId,
            };


        if (query.status) {
            where.status =
                query.status;
        }


        if (query.channel) {
            where.channel =
                query.channel;
        }


        if (query.channelAccountId) {
            where.channelAccountId =
                query.channelAccountId;
        }


        if (query.unassigned === true) {

            where.assignedUserId =
                null;

        } else if (query.assignedUserId) {

            where.assignedUserId =
                query.assignedUserId;
        }


        if (query.search) {

            where.OR = [
                {
                    subject: {
                        contains:
                            query.search,
                    },
                },

                {
                    contact: {
                        is: {
                            displayName: {
                                contains:
                                    query.search,
                            },
                        },
                    },
                },

                {
                    contact: {
                        is: {
                            phone: {
                                contains:
                                    query.search,
                            },
                        },
                    },
                },

                {
                    contact: {
                        is: {
                            email: {
                                contains:
                                    query.search,
                            },
                        },
                    },
                },

                {
                    messages: {
                        some: {
                            body: {
                                contains:
                                    query.search,
                            },
                        },
                    },
                },
            ];
        }


        return where;
    }
}