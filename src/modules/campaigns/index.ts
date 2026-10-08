import { CampaignController } from './controllers/campaign.controller';
import { PrismaCampaignRepository } from './repositories/prisma-campaign.repository';
import { createCampaignRouter } from './routes/campaign.routes';
import { CampaignService } from './services/campaign.service';

const repository = new PrismaCampaignRepository();
const service = new CampaignService(repository);
const controller = new CampaignController(service);

export const campaignRouter = createCampaignRouter(controller);
