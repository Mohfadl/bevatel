import { z } from 'zod';

export const reportOverviewQuerySchema = z.object({
    from: z
        .string()
        .trim()
        .optional(),

    to: z
        .string()
        .trim()
        .optional(),
});

export type ReportOverviewQuery =
    z.infer<typeof reportOverviewQuerySchema>;