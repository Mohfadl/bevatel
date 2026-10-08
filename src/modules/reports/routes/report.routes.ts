import {
    Router,
} from 'express';

import {
    authMiddleware,
} from '../../../middleware/auth.middleware';

import {
    PrismaReportRepository,
} from '../repositories/prisma-report.repository';

import {
    ReportService,
} from '../services/report.service';

import {
    ReportController,
} from '../controllers/report.controller';

const router =
    Router();

const repository =
    new PrismaReportRepository();

const service =
    new ReportService(
        repository,
    );

const controller =
    new ReportController(
        service,
    );

router.use(
    authMiddleware,
);

router.get(
    '/overview',
    controller.overview,
);

export {
    router as reportRouter,
};