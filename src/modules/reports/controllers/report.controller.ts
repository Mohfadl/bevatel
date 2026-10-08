import type {
    Response,
} from 'express';

import {
    ZodError,
} from 'zod';

import type {
    AuthenticatedRequest,
} from '../../../middleware/auth.middleware';

import {
    reportOverviewQuerySchema,
} from '../validators/report.validator';

import type {
    ReportService,
} from '../services/report.service';

export class ReportController {
    constructor(
        private readonly service:
            ReportService,
    ) {}

    overview =
        async (
            request:
                AuthenticatedRequest,
            response:
                Response,
        ): Promise<void> => {
            try {
                const organizationId =
                    request.user
                        ?.organizationId;

                if (!organizationId) {
                    response
                        .status(401)
                        .json({
                            success:
                                false,

                            message:
                                'Unauthorized.',
                        });

                    return;
                }

                const query =
                    reportOverviewQuerySchema
                        .parse(
                            request.query,
                        );

                const data =
                    await this.service
                        .getOverview(
                            organizationId,
                            query.from,
                            query.to,
                        );

                response.json({
                    success: true,
                    data,
                });
            } catch (error) {
                if (
                    error instanceof
                    ZodError
                ) {
                    response
                        .status(422)
                        .json({
                            success:
                                false,

                            message:
                                'Invalid report filters.',

                            errors:
                                error.issues,
                        });

                    return;
                }

                if (
                    error instanceof
                    Error
                ) {
                    const knownMessages =
                        [
                            'The from date cannot be after the to date.',
                            'Dates must use YYYY-MM-DD format.',
                            'Invalid report date.',
                            'Report range cannot exceed 31 days.',
                        ];

                    if (
                        knownMessages.includes(
                            error.message,
                        )
                    ) {
                        response
                            .status(422)
                            .json({
                                success:
                                    false,

                                message:
                                    error.message,
                            });

                        return;
                    }

                    console.error(
                        'Report overview error:',
                        error,
                    );
                }

                response
                    .status(500)
                    .json({
                        success: false,

                        message:
                            'Unable to load reports.',
                    });
            }
        };
}