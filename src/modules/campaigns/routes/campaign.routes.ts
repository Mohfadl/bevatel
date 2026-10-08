import { Router } from 'express';
import { allowRoles, authMiddleware } from '../../../middleware/auth.middleware';
import type { CampaignController } from '../controllers/campaign.controller';

export function createCampaignRouter(controller: CampaignController) {
  const router = Router();
  router.use(authMiddleware);
  router.use(allowRoles('SUPER_ADMIN', 'ADMIN', 'SUPERVISOR'));
  router.get('/options', controller.options);
  router.get('/', controller.list);
  router.get('/:id', controller.get);
  router.post('/', controller.create);
  router.post('/:id/cancel', controller.cancel);
  return router;
}
 