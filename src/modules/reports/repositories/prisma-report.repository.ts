import { prisma } from '../../../../shared/prisma';

import type {
    AgentConversationReportDto,
    ChannelReportDto,
    ConversationStatusReportDto,
    ConversationTrafficCellDto,
} from '../dto/report.dto';

import type {
    ReportRepository,
} from './report.repository';

export class PrismaReportRepository
    implements ReportRepository
{
    async getConversationStatus(
        organizationId: string,
        from: Date,
        to: Date,
    ): Promise<ConversationStatusReportDto> {
        const dateFilter = {
            gte: from,
            lte: to,
        };

        const [
            open,
            unattended,
            resolved,
            closed,
            unassigned,
        ] = await Promise.all([
            prisma.conversation.count({
                where: {
                    organizationId,
                    status: 'OPEN',
                    createdAt: dateFilter,
                },
            }),

            prisma.conversation.count({
                where: {
                    organizationId,

                    status: {
                        in: [
                            'OPEN',
                            'PENDING',
                        ],
                    },

                    assignedUserId: null,

                    createdAt: dateFilter,
                },
            }),

            prisma.conversation.count({
                where: {
                    organizationId,
                    status: 'RESOLVED',
                    createdAt: dateFilter,
                },
            }),

            prisma.conversation.count({
                where: {
                    organizationId,
                    status: 'CLOSED',
                    createdAt: dateFilter,
                },
            }),

            prisma.conversation.count({
                where: {
                    organizationId,

                    assignedUserId: null,

                    status: {
                        in: [
                            'OPEN',
                            'PENDING',
                        ],
                    },

                    createdAt: dateFilter,
                },
            }),
        ]);

        return {
            open,
            unattended,
            resolved,
            closed,
            unassigned,
        };
    }

    async getAgentStatus(
        organizationId: string,
    ): Promise<{
        online: number;
        busy: number;
        offline: number;
    }> {
        /*
         * Your current User model does not contain a persisted
         * presence/status field such as ONLINE/AWAY/BUSY/OFFLINE.
         *
         * For now:
         * - ACTIVE users are counted as online
         * - SUSPENDED users are counted as offline
         * - busy remains zero
         *
         * Later this should use your realtime presence storage.
         */

        const [online,offline] = await Promise.all([
            prisma.user.count({
                where: {
                    organizationId,
                    status: 'ACTIVE',
                    role: {
                        in: ['SUPER_ADMIN','ADMIN','SUPERVISOR','AGENT'],
                    },
                },
            }),

            prisma.user.count({
                where: {
                    organizationId,
                    status: 'SUSPENDED',
                    role: {
                        in: ['AGENT','SUPERVISOR','ADMIN'],
                    },
                },
            }),
        ]);

        return {
            online,
            busy: 0,
            offline,
        };
    }

    async getConversationTraffic(
        organizationId: string,
        from: Date,
        to: Date,
    ): Promise<ConversationTrafficCellDto[]> {
        const conversations =
            await prisma.conversation.findMany({
                where: {
                    organizationId,

                    createdAt: {
                        gte: from,
                        lte: to,
                    },
                },

                select: {
                    createdAt: true,
                },

                orderBy: {
                    createdAt: 'asc',
                },
            });

        const grouped =
            new Map<string, number>();

        for (const conversation of conversations) {
            const date =
                this.formatDate(
                    conversation.createdAt,
                );

            const hour =
                conversation.createdAt.getHours();

            const key =
                `${date}:${hour}`;

            grouped.set(
                key,
                (grouped.get(key) ?? 0) + 1,
            );
        }

        const result:
            ConversationTrafficCellDto[] = [];

        const current =
            new Date(from);

        current.setHours(
            0,
            0,
            0,
            0,
        );

        const end =
            new Date(to);

        end.setHours(
            0,
            0,
            0,
            0,
        );

        while (
            current.getTime() <=
            end.getTime()
        ) {
            const date =
                this.formatDate(current);

            const day =
                current.toLocaleDateString(
                    'en-US',
                    {
                        weekday: 'long',
                    },
                );

            for (
                let hour = 0;
                hour < 24;
                hour += 1
            ) {
                const key =
                    `${date}:${hour}`;

                result.push({
                    date,
                    day,
                    hour,
                    count:
                        grouped.get(key) ?? 0,
                });
            }

            current.setDate(
                current.getDate() + 1,
            );
        }

        return result;
    }

    async getAgentConversationStats(organizationId: string,from: Date,to: Date,): Promise<AgentConversationReportDto[]> {
        const users =
            await prisma.user.findMany({
                where: {
                    organizationId,
                    status: 'ACTIVE',
                    role: {
                        in: [
                            'SUPER_ADMIN',
                            'ADMIN',
                            'SUPERVISOR',
                            'AGENT',
                        ],
                    },
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    role: true,
                },
                orderBy: {
                    name: 'asc',
                },
            });

        const result: AgentConversationReportDto[] = [];
        for (const user of users) {
            const baseWhere = {
                organizationId,
                assignedUserId: user.id,
                createdAt: {
                    gte: from,
                    lte: to,
                },
            };

            const [open,pending,resolved,closed,total] = await Promise.all([
                prisma.conversation.count({where: {...baseWhere, status: 'OPEN'},}),
                prisma.conversation.count({where: {...baseWhere, status: 'PENDING'},}),
                prisma.conversation.count({where: {...baseWhere, status: 'RESOLVED'},}),
                prisma.conversation.count({where: {...baseWhere,status: 'CLOSED'},}),
                prisma.conversation.count({where: baseWhere}),
            ]);

            result.push({
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,

                open,
                pending,
                resolved,
                closed,
                total,
            });
        }
        return result.sort((a, b) => b.total - a.total);
    }

    async getChannelStats(
        organizationId: string,
        from: Date,
        to: Date,
    ): Promise<ChannelReportDto[]> {
        const grouped =
            await prisma.conversation.groupBy({
                by: [
                    'channel',
                ],

                where: {
                    organizationId,

                    createdAt: {
                        gte: from,
                        lte: to,
                    },
                },

                _count: {
                    _all: true,
                },
            });

        const total =
            grouped.reduce(
                (
                    sum,
                    item,
                ) =>
                    sum +
                    item._count._all,
                0,
            );

        return grouped
            .map(item => {
                const conversations =
                    item._count._all;

                const percentage =
                    total > 0
                        ? Number(
                              (
                                  (
                                      conversations /
                                      total
                                  ) *
                                  100
                              ).toFixed(2),
                          )
                        : 0;

                return {
                    channel:
                        item.channel,

                    conversations,

                    percentage,
                };
            })
            .sort(
                (
                    a,
                    b,
                ) =>
                    b.conversations -
                    a.conversations,
            );
    }

    private formatDate(
        date: Date,
    ): string {
        const year =
            date.getFullYear();

        const month =
            String(
                date.getMonth() + 1,
            ).padStart(
                2,
                '0',
            );

        const day = String(date.getDate(),).padStart(2,'0',);
        return `${year}-${month}-${day}`;
    }
}  