import type { CampaignListQuery, CreateCampaignInput } from '../types/campaign.types';

export interface CampaignRepository {
  findMany(query: CampaignListQuery): Promise<{ campaigns: unknown[]; total: number }>;
  findById(organizationId: string, campaignId: string): Promise<any | null>;
  create(input: CreateCampaignInput): Promise<any>;
  cancel(organizationId: string, campaignId: string): Promise<any | null>;
  getActiveWhatsAppAccounts(organizationId: string): Promise<unknown[]>;
  getLabels(organizationId: string): Promise<unknown[]>;
}
