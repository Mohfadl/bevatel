import type { NextFunction, Response } from 'express';
import type { AuthRequest } from '../../../middleware/auth.middleware';
import type { CampaignService } from '../services/campaign.service';

export class CampaignController {
  constructor(private readonly service: CampaignService) {}

  list = async (request: AuthRequest, response: Response, next: NextFunction) => {
    try {
      const data = await this.service.list(request.user!.organizationId, request.query);
      response.json({ success: true, data });
    } catch (error) { next(error); }
  };

  get = async (request: AuthRequest, response: Response, next: NextFunction) => {
    try {
      const data = await this.service.get(request.user!.organizationId, request.params.id);
      response.json({ success: true, data });
    } catch (error) { next(error); }
  };

  options = async (request: AuthRequest, response: Response, next: NextFunction) => {
    try {
      const data = await this.service.formOptions(request.user!.organizationId);
      response.json({ success: true, data });
    } catch (error) { next(error); }
  };

  create = async (request: AuthRequest, response: Response, next: NextFunction) => {
    try {
      const data = await this.service.create(
        request.user!.organizationId,
        request.user!.id,
        request.body,
      );
      response.status(201).json({ success: true, message: 'Campaign created.', data });
    } catch (error) { next(error); }
  };

  cancel = async (request: AuthRequest, response: Response, next: NextFunction) => {
    try {
      const data = await this.service.cancel(request.user!.organizationId, request.params.id);
      response.json({ success: true, message: 'Campaign cancelled.', data });
    } catch (error) { next(error); }
  };
}
