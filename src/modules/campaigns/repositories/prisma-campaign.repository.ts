import { Prisma } from '../../../../generated/prisma/client';
import prisma from '../../../../shared/prisma';
import type { CampaignRepository } from './campaign.repository';
import type { CampaignListQuery, CreateCampaignInput } from '../types/campaign.types';

export class PrismaCampaignRepository implements CampaignRepository {
  async findMany(query: CampaignListQuery) {
    const where: Prisma.CampaignWhereInput = {
      organizationId: query.organizationId,
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.search ? { title: { contains: query.search } } : {}),
    };

    const [total, campaigns] = await prisma.$transaction([
      prisma.campaign.count({ where }),
      prisma.campaign.findMany({
        where,
        include: {
          channelAccount: {
            select: { id: true, name: true, channel: true, phoneNumberId: true },
          },
          audienceLabel: { select: { id: true, name: true, color: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.perPage,
        take: query.perPage,
      }),
    ]);

    return { campaigns, total };
  }

  async findById(organizationId: string, campaignId: string) {
    return prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      include: {
        channelAccount: {
          select: { id: true, name: true, channel: true, phoneNumberId: true },
        },
        audienceLabel: { select: { id: true, name: true, color: true } },
        recipients: {
          include: {
            contact: {
              select: { id: true, displayName: true, phone: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        },
      },
    });
  }

  async create(input: CreateCampaignInput) {
    return prisma.campaign.create({
      data: {
        organizationId: input.organizationId,
        createdByUserId: input.createdByUserId,
        channelAccountId: input.channelAccountId,
        title: input.title,
        channel: 'WHATSAPP',
        audienceType: input.audienceType,
        audienceLabelId: input.audienceLabelId ?? null,
        templateName: input.templateName,
        templateLanguageCode: input.templateLanguageCode,
        templateComponents: input.templateComponents
          ? (input.templateComponents as Prisma.InputJsonValue)
          : undefined,
        scheduledAt: input.scheduledAt ?? null,
        status: input.scheduledAt && input.scheduledAt.getTime() > Date.now()
          ? 'SCHEDULED'
          : 'DRAFT',
      },
    });
  }

  async cancel(organizationId: string, campaignId: string) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, organizationId },
      select: { id: true, status: true },
    });

    if (!campaign) return null;
    if (['COMPLETED', 'CANCELLED'].includes(campaign.status)) {
      return prisma.campaign.findUnique({ where: { id: campaign.id } });
    }

    return prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'CANCELLED' },
    });
  }

  async getActiveWhatsAppAccounts(organizationId: string) {
    return prisma.channelAccount.findMany({
      where: { organizationId, channel: 'WHATSAPP', status: 'ACTIVE' },
      select: { id: true, name: true, phoneNumberId: true, externalAccountId: true },
      orderBy: { name: 'asc' },
    });
  }

  async getLabels(organizationId: string) {
    return prisma.label.findMany({
      where: { organizationId },
      select: { id: true, name: true, color: true },
      orderBy: { name: 'asc' },
    });
  }
}
