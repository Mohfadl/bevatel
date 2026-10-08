import {
  Router,
} from 'express';

import {
  authMiddleware,
  type AuthRequest,
} from '../../../shared/auth';

import {
  getDashboardOverview,
} from './dashboard.service';

const router = Router();

router.get(
  '/overview',
  authMiddleware,
  async (
    request: AuthRequest,
    response,
  ) => {
    try {
      if (!request.user) {
        return response
          .status(401)
          .json({
            success: false,
            message: 'Unauthorized',
          });
      }

      const organizationId =
        request.user.organizationId;

      const overview =
        await getDashboardOverview(
          organizationId,
        );

      return response
        .status(200)
        .json({
          success: true,
          data: overview,
        });
    } catch (error) {
      console.error(
        'Dashboard overview error:',
        error,
      );

      return response
        .status(500)
        .json({
          success: false,

          message:
            error instanceof Error
              ? error.message
              : 'Unable to load dashboard',
        });
    }
  },
);

export default router;