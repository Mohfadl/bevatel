import prisma from '../../../../shared/prisma';
import { campaignQueue } from '../queues/campaign.queue';
import type { CampaignRepository } from '../repositories/campaign.repository';
import type { CampaignAudienceType } from '../types/campaign.types';

function httpError(message: string, statusCode: number, code: string) {
  const error = new Error(message) as Error & { statusCode?: number; code?: string };
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

export class CampaignService {
  constructor(private readonly repository: CampaignRepository) {}

  async list(organizationId: string, query: Record<string, unknown>) {
    const page = Math.max(1, Number(query.page ?? 1) || 1);
    const perPage = Math.min(100, Math.max(1, Number(query.perPage ?? 20) || 20));
    const result = await this.repository.findMany({
      organizationId,
      page,
      perPage,
      status: typeof query.status === 'string' && query.status ? query.status : undefined,
      search: typeof query.search === 'string' && query.search.trim() ? query.search.trim() : undefined,
    });

    return {
      ...result,
      pagination: {
        page,
        perPage,
        total: result.total,
        totalPages: Math.ceil(result.total / perPage),
      },
    };
  }

  async get(organizationId: string, campaignId: string) {
    const campaign = await this.repository.findById(organizationId, campaignId);
    if (!campaign) throw httpError('Campaign not found.', 404, 'CAMPAIGN_NOT_FOUND');
    return campaign;
  }

  async formOptions(organizationId: string) {
    const [channels, labels] = await Promise.all([
      this.repository.getActiveWhatsAppAccounts(organizationId),
      this.repository.getLabels(organizationId),
    ]);
    return { channels, labels };
  }

  async create(
    organizationId: string,
    userId: string,
    body: Record<string, unknown>,
  ) {
    const title = String(body.title ?? '').trim();
    const channelAccountId = String(body.channelAccountId ?? '').trim();
    const audienceType = String(body.audienceType ?? 'ALL_CONTACTS') as CampaignAudienceType;
    const audienceLabelId = body.audienceLabelId ? String(body.audienceLabelId) : null;
    const templateName = String(body.templateName ?? '').trim();
    const templateLanguageCode = String(body.templateLanguageCode ?? 'en').trim();
    const templateComponents = Array.isArray(body.templateComponents) ? body.templateComponents : null;

    if (!title) throw httpError('Title is required.', 422, 'TITLE_REQUIRED');
    if (!channelAccountId) throw httpError('WhatsApp channel is required.', 422, 'CHANNEL_REQUIRED');
    if (!['ALL_CONTACTS', 'LABEL'].includes(audienceType)) {
      throw httpError('Audience type must be ALL_CONTACTS or LABEL.', 422, 'INVALID_AUDIENCE');
    }
    if (audienceType === 'LABEL' && !audienceLabelId) {
      throw httpError('Audience label is required.', 422, 'LABEL_REQUIRED');
    }
    if (!templateName) throw httpError('WhatsApp template name is required.', 422, 'TEMPLATE_REQUIRED');
    if (!templateLanguageCode) throw httpError('Template language is required.', 422, 'LANGUAGE_REQUIRED');

    const account = await prisma.channelAccount.findFirst({
      where: {
        id: channelAccountId,
        organizationId,
        channel: 'WHATSAPP',
        status: 'ACTIVE',
      },
      select: { id: true, phoneNumberId: true },
    });
    if (!account?.phoneNumberId) {
      throw httpError('Active WhatsApp channel was not found or phoneNumberId is missing.', 422, 'INVALID_CHANNEL');
    }

    if (audienceType === 'LABEL') {
      const label = await prisma.label.findFirst({ where: { id: audienceLabelId!, organizationId } });
      if (!label) throw httpError('Audience label not found.', 422, 'INVALID_LABEL');
    }

    let scheduledAt: Date | null = null;
    if (body.scheduledAt) {
      scheduledAt = new Date(String(body.scheduledAt));
      if (Number.isNaN(scheduledAt.getTime())) {
        throw httpError('Scheduled time is invalid.', 422, 'INVALID_SCHEDULE');
      }
    }

    const campaign = await this.repository.create({
      organizationId,
      createdByUserId: userId,
      channelAccountId,
      title,
      audienceType,
      audienceLabelId,
      templateName,
      templateLanguageCode,
      templateComponents,
      scheduledAt,
    });

    const delay = scheduledAt ? Math.max(0, scheduledAt.getTime() - Date.now()) : 0;
    await campaignQueue.add(
      'prepare-campaign',
      { campaignId: campaign.id },
      { jobId: `prepare:${campaign.id}`, delay },
    );

    if (!scheduledAt || delay === 0) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: 'SCHEDULED', scheduledAt: new Date() },
      });
    }

    return this.repository.findById(organizationId, campaign.id);
  }

  async cancel(organizationId: string, campaignId: string) {
    const campaign = await this.repository.cancel(organizationId, campaignId);
    if (!campaign) throw httpError('Campaign not found.', 404, 'CAMPAIGN_NOT_FOUND');
    return campaign;
  }
}
