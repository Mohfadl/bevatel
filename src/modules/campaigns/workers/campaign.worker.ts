import 'dotenv/config';
import { Worker } from 'bullmq';
import { Prisma } from '../../../../generated/prisma/client';
import prisma from '../../../../shared/prisma';
import { CAMPAIGN_QUEUE_NAME, campaignQueue } from '../queues/campaign.queue';

const connection = {
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
};

type WhatsAppTemplateResponse = {
  messages?: Array<{ id?: string; message_status?: string }>;
  error?: { message?: string; code?: number; error_subcode?: number; fbtrace_id?: string };
};

function normalizeRecipient(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

async function refreshCampaignCounters(campaignId: string) {
  const grouped = await prisma.campaignRecipient.groupBy({
    by: ['status'],
    where: { campaignId },
    _count: { _all: true },
  });

  const counts = new Map(grouped.map(row => [row.status, row._count._all]));
  const totalRecipients = grouped.reduce((sum, row) => sum + row._count._all, 0);
  const queuedCount = counts.get('QUEUED') ?? 0;
  const sentCount = counts.get('SENT') ?? 0;
  const deliveredCount = counts.get('DELIVERED') ?? 0;
  const readCount = counts.get('READ') ?? 0;
  const failedCount = counts.get('FAILED') ?? 0;
  const skippedCount = counts.get('SKIPPED') ?? 0;
  const sendingCount = counts.get('SENDING') ?? 0;
  const finished = totalRecipients > 0 && queuedCount === 0 && sendingCount === 0;

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      totalRecipients,
      queuedCount,
      sentCount,
      deliveredCount,
      readCount,
      failedCount,
      skippedCount,
      ...(finished ? { status: 'COMPLETED', completedAt: new Date() } : {}),
    },
  });
}

async function prepareCampaign(campaignId: string) {
  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { channelAccount: true },
  });

  if (!campaign) throw new Error(`Campaign ${campaignId} not found`);
  if (campaign.status === 'CANCELLED') return;
  if (campaign.channel !== 'WHATSAPP') throw new Error('Only WhatsApp campaigns are supported.');
  if (campaign.channelAccount.status !== 'ACTIVE' || !campaign.channelAccount.phoneNumberId) {
    throw new Error('Campaign WhatsApp channel is not active or phoneNumberId is missing.');
  }

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { status: 'RUNNING', startedAt: campaign.startedAt ?? new Date() },
  });

  const contacts = await prisma.contact.findMany({
    where: {
      organizationId: campaign.organizationId,
      status: 'ACTIVE',
      ...(campaign.audienceType === 'LABEL' && campaign.audienceLabelId
        ? { contactLabels: { some: { labelId: campaign.audienceLabelId } } }
        : {}),
      identities: { some: { channel: 'WHATSAPP' } },
    },
    select: {
      id: true,
      phone: true,
      identities: {
        where: { channel: 'WHATSAPP' },
        select: { externalId: true, phone: true },
        take: 1,
      },
    },
  });

  const recipients = contacts
    .map(contact => {
      const identity = contact.identities[0];
      const raw = identity?.phone ?? identity?.externalId ?? contact.phone ?? '';
      const recipientExternalId = normalizeRecipient(raw);
      return recipientExternalId ? {
        organizationId: campaign.organizationId,
        campaignId: campaign.id,
        contactId: contact.id,
        recipientExternalId,
        status: 'QUEUED' as const,
      } : null;
    })
    .filter((value): value is NonNullable<typeof value> => Boolean(value));

  if (recipients.length === 0) {
    await prisma.campaign.update({
      where: { id: campaign.id },
      data: { status: 'COMPLETED', completedAt: new Date(), totalRecipients: 0 },
    });
    return;
  }

  await prisma.campaignRecipient.createMany({ data: recipients, skipDuplicates: true });

  const storedRecipients = await prisma.campaignRecipient.findMany({
    where: { campaignId: campaign.id, status: 'QUEUED' },
    select: { id: true },
  });

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { totalRecipients: storedRecipients.length, queuedCount: storedRecipients.length },
  });

  await campaignQueue.addBulk(
    storedRecipients.map(recipient => ({
      name: 'send-recipient',
      data: { recipientId: recipient.id },
      opts: { jobId: `recipient:${recipient.id}` },
    })),
  );
}

async function sendRecipient(recipientId: string) {
  const recipient = await prisma.campaignRecipient.findUnique({
    where: { id: recipientId },
    include: {
      campaign: { include: { channelAccount: true } },
      contact: true,
    },
  });

  if (!recipient) throw new Error(`Campaign recipient ${recipientId} not found`);
  if (recipient.campaign.status === 'CANCELLED') {
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { status: 'SKIPPED', errorMessage: 'Campaign cancelled.' },
    });
    await refreshCampaignCounters(recipient.campaignId);
    return;
  }
  if (['SENT', 'DELIVERED', 'READ'].includes(recipient.status)) return;

  const account = recipient.campaign.channelAccount;
  if (!account.phoneNumberId) throw new Error('WhatsApp phoneNumberId is missing.');

  await prisma.campaignRecipient.update({
    where: { id: recipient.id },
    data: { status: 'SENDING', attempts: { increment: 1 }, errorMessage: null },
  });

  const graphVersion = process.env.META_GRAPH_VERSION ?? 'v26.0';
  const url = `https://graph.facebook.com/${graphVersion}/${account.phoneNumberId}/messages`;
  const components = Array.isArray(recipient.campaign.templateComponents)
    ? recipient.campaign.templateComponents
    : undefined;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: recipient.recipientExternalId,
        type: 'template',
        template: {
          name: recipient.campaign.templateName,
          language: { code: recipient.campaign.templateLanguageCode },
          ...(components?.length ? { components } : {}),
        },
      }),
    });

    const result = await response.json() as WhatsAppTemplateResponse;
    if (!response.ok) {
      throw new Error(result.error?.message ?? 'WhatsApp template API request failed.');
    }

    const externalMessageId = result.messages?.[0]?.id;
    if (!externalMessageId) throw new Error('WhatsApp did not return a message id.');

    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: {
        status: 'SENT',
        externalMessageId,
        sentAt: new Date(),
        errorMessage: null,
      },
    });

    await refreshCampaignCounters(recipient.campaignId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.campaignRecipient.update({
      where: { id: recipient.id },
      data: { status: 'FAILED', failedAt: new Date(), errorMessage: message },
    });
    await refreshCampaignCounters(recipient.campaignId);
    throw error;
  }
}

export async function updateCampaignRecipientFromWhatsAppStatus(
  organizationId: string,
  externalMessageId: string,
  status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED',
) {
  const recipient = await prisma.campaignRecipient.findFirst({
    where: { organizationId, externalMessageId },
  });
  if (!recipient) return false;

  await prisma.campaignRecipient.update({
    where: { id: recipient.id },
    data: {
      status,
      ...(status === 'SENT' ? { sentAt: new Date() } : {}),
      ...(status === 'DELIVERED' ? { deliveredAt: new Date() } : {}),
      ...(status === 'READ' ? { readAt: new Date() } : {}),
      ...(status === 'FAILED' ? { failedAt: new Date() } : {}),
    },
  });
  await refreshCampaignCounters(recipient.campaignId);
  return true;
}

export const campaignWorker = new Worker(
  CAMPAIGN_QUEUE_NAME,
  async job => {
    if (job.name === 'prepare-campaign') {
      await prepareCampaign(String(job.data.campaignId));
      return;
    }
    if (job.name === 'send-recipient') {
      await sendRecipient(String(job.data.recipientId));
      return;
    }
    throw new Error(`Unknown campaign job: ${job.name}`);
  },
  { connection, concurrency: Number(process.env.CAMPAIGN_CONCURRENCY ?? 5) },
);

campaignWorker.on('completed', job => console.log(`Campaign job completed: ${job.id}`));
campaignWorker.on('failed', (job, error) => console.error(`Campaign job failed: ${job?.id}`, error));
console.log('Campaign worker started');
