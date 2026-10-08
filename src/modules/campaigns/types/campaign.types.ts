export type CampaignAudienceType = 'ALL_CONTACTS' | 'LABEL';

export type CreateCampaignInput = {
  organizationId: string;
  createdByUserId: string;
  channelAccountId: string;
  title: string;
  audienceType: CampaignAudienceType;
  audienceLabelId?: string | null;
  templateName: string;
  templateLanguageCode: string;
  templateComponents?: unknown[] | null;
  scheduledAt?: Date | null;
};

export type CampaignListQuery = {
  organizationId: string;
  page: number;
  perPage: number;
  status?: string;
  search?: string;
};
