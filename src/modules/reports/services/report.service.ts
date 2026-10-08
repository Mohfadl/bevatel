import type {
    ReportsOverviewDto,
} from '../dto/report.dto';

import type {
    ReportRepository,
} from '../repositories/report.repository';

export class ReportService {
    constructor(
        private readonly repository:
            ReportRepository,
    ) {}

    async getOverview(
        organizationId: string,
        fromInput?: string,
        toInput?: string,
    ): Promise<ReportsOverviewDto> {
        const {
            from,
            to,
        } =
            this.resolveDateRange(
                fromInput,
                toInput,
            );

        const [
            conversationStatus,
            agentStatus,
            conversationTraffic,
            agents,
            channels,
        ] = await Promise.all([
            this.repository
                .getConversationStatus(
                    organizationId,
                    from,
                    to,
                ),

            this.repository
                .getAgentStatus(
                    organizationId,
                ),

            this.repository
                .getConversationTraffic(
                    organizationId,
                    from,
                    to,
                ),

            this.repository
                .getAgentConversationStats(
                    organizationId,
                    from,
                    to,
                ),

            this.repository
                .getChannelStats(
                    organizationId,
                    from,
                    to,
                ),
        ]);

        return {
            range: {
                from:
                    this.formatDate(from),

                to:
                    this.formatDate(to),
            },

            conversationStatus,

            agentStatus,

            conversationTraffic,

            agents,

            channels,
        };
    }

    private resolveDateRange(
        fromInput?: string,
        toInput?: string,
    ): {
        from: Date;
        to: Date;
    } {
        const now =
            new Date();

        let to =
            toInput
                ? this.parseDate(
                      toInput,
                  )
                : new Date(now);

        let from =
            fromInput
                ? this.parseDate(
                      fromInput,
                  )
                : new Date(now);

        if (!fromInput) {
            from.setDate(
                from.getDate() - 6,
            );
        }

        from.setHours(
            0,
            0,
            0,
            0,
        );

        to.setHours(
            23,
            59,
            59,
            999,
        );

        if (
            from.getTime() >
            to.getTime()
        ) {
            throw new Error(
                'The from date cannot be after the to date.',
            );
        }

        const maximumDays = 31;

        const difference =
            to.getTime() -
            from.getTime();

        const days =
            Math.ceil(
                difference /
                    (
                        1000 *
                        60 *
                        60 *
                        24
                    ),
            );

        if (
            days >
            maximumDays
        ) {
            throw new Error(
                `Report range cannot exceed ${maximumDays} days.`,
            );
        }

        return {
            from,
            to,
        };
    }

    private parseDate(
        value: string,
    ): Date {
        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(
                value,
            )
        ) {
            throw new Error(
                'Dates must use YYYY-MM-DD format.',
            );
        }

        const [
            year,
            month,
            day,
        ] =
            value
                .split('-')
                .map(Number);

        const date =
            new Date(
                year,
                month - 1,
                day,
            );

        if (
            date.getFullYear() !==
                year ||
            date.getMonth() !==
                month - 1 ||
            date.getDate() !==
                day
        ) {
            throw new Error(
                'Invalid report date.',
            );
        }

        return date;
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

        const day =
            String(
                date.getDate(),
            ).padStart(
                2,
                '0',
            );

        return `${year}-${month}-${day}`;
    }
}