import 'dotenv/config';

import {
  Worker,
  Job,
} from 'bullmq';

import {
  MessageType,
  Prisma,
} from '../../../generated/prisma/client';

import {
  emitToOrganization,
  emitToConversation,
} from '../../realtime/socket';

import {
  prisma,
} from '../../../shared/prisma';

import {
  processInstagramWebhook,
  type InstagramWebhookPayload,
} from './handlers/instagram-webhook.handler';

const META_QUEUE_NAME = 'meta-webhooks';

let metaWorker: Worker<MetaWebhookJobData> | null = null;
type MetaWebhookJobData = {receiptId: string;};
 
type MetaWebhookPayload = {
  object?: string;
  entry?: unknown[];
};


type WhatsAppMetadata = {
  display_phone_number?: string;
  phone_number_id?: string;
};


type WhatsAppContact = {
  profile?: {
    name?: string;
  };
  wa_id?: string;
};


type WhatsAppTextMessage = {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;

  text?: {
    body?: string;
  };

  context?: {
    from?: string;
    id?: string;
  };

  image?: {
    id?: string;
    mime_type?: string;
    sha256?: string;
    caption?: string;
  };

  video?: {
    id?: string;
    mime_type?: string;
    sha256?: string;
    caption?: string;
  };

  audio?: {
    id?: string;
    mime_type?: string;
    sha256?: string;
  };

  document?: {
    id?: string;
    mime_type?: string;
    sha256?: string;
    filename?: string;
    caption?: string;
  };

  sticker?: {
    id?: string;
    mime_type?: string;
    sha256?: string;
    animated?: boolean;
  };

  location?: {
    latitude?: number;
    longitude?: number;
    name?: string;
    address?: string;
  };

  contacts?: unknown[];

  interactive?: unknown;

  button?: unknown;

  [key: string]: unknown;
};


type WhatsAppStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;

  conversation?: unknown;
  pricing?: unknown;
  errors?: unknown[];

  [key: string]: unknown;
};

type WhatsAppValue = {
  messaging_product?: string;
  metadata?: WhatsAppMetadata;
  contacts?: WhatsAppContact[];
  messages?: WhatsAppTextMessage[];
  statuses?: WhatsAppStatus[];
  [key: string]: unknown;
};


type WhatsAppChange = {
  field?: string;
  value?: WhatsAppValue;
};


type WhatsAppEntry = {
  id?: string;
  changes?: WhatsAppChange[];
};


type WhatsAppWebhookPayload = {
  object?: string;
  entry?: WhatsAppEntry[];
};

type MessengerUser = {
  id?: string;
};


type MessengerMessageAttachment = {
  type?: string;
  payload?: {
    url?: string;
    sticker_id?: number;
    coordinates?: {
      lat?: number;
      long?: number;
    };
    [key: string]: unknown;
  };

  [key: string]: unknown;
};


type MessengerMessage = {
  mid?: string;
  text?: string;
  reply_to?: {
    mid?: string;
  };

  attachments?: MessengerMessageAttachment[];
  is_echo?: boolean;
  app_id?: number;
  metadata?: string;
  [key: string]: unknown;
};

type MessengerDelivery = {
  mids?: string[];
  watermark?: number;
  [key: string]: unknown;
};

type MessengerRead = {
  watermark?: number;
  [key: string]: unknown;
};

type MessengerPostback = {
  title?: string;
  payload?: string;
  mid?: string;
  [key: string]: unknown;
};

type MessengerMessagingEvent = {
  sender?: MessengerUser;
  recipient?: MessengerUser;
  timestamp?: number;
  message?: MessengerMessage;
  delivery?: MessengerDelivery;
  read?: MessengerRead;
  postback?: MessengerPostback;
  [key: string]: unknown;
};


type MessengerEntry = {
  id?: string;
  time?: number;
  messaging?: MessengerMessagingEvent[];
};

type MessengerWebhookPayload = {
  object?: string;
  entry?: MessengerEntry[];
};


function toPrismaJson(
  value: unknown,
): Prisma.InputJsonValue {
  return JSON.parse(
    JSON.stringify(value),
  ) as Prisma.InputJsonValue;
}


function getErrorMessage(
  error: unknown,
): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}


function mapWhatsAppStatus(
  status?: string,
):
  | 'SENT'
  | 'DELIVERED'
  | 'READ'
  | 'FAILED'
  | null {
  switch (
    String(status ?? '').toLowerCase()
  ) {
    case 'sent':
      return 'SENT';

    case 'delivered':
      return 'DELIVERED';

    case 'read':
      return 'READ';

    case 'failed':
      return 'FAILED';

    default:
      return null;
  }
}


function resolveWhatsAppMessageType(type?: string,): MessageType {
  switch (String(type ?? '').toLowerCase()) {
    case 'text':
      return MessageType.TEXT;
    case 'image':
      return MessageType.IMAGE;
    case 'video':
      return MessageType.VIDEO;
    case 'audio':
      return MessageType.AUDIO;
    case 'document':
      return MessageType.DOCUMENT;
    case 'location':
      return MessageType.LOCATION;
    case 'contacts':
      return MessageType.CONTACT;
    case 'sticker':
      return MessageType.STICKER;
    case 'interactive':
      return MessageType.INTERACTIVE;
    case 'template':
      return MessageType.TEMPLATE;
    default:
      return MessageType.TEXT;
  }
}


function resolveWhatsAppMessageBody(message: WhatsAppTextMessage,): string | null {
  const type = String(message.type ?? '',).toLowerCase();
  if (type === 'text') {
    return message.text?.body ?? null;
  }

  if (type === 'image') {
    return message.image?.caption ?? null;
  }

  if (type === 'video') {
    return message.video?.caption ?? null;
  }

  if (type === 'document') {
    return (
      message.document?.caption ??
      message.document?.filename ??
      null
    );
  }

  if (type === 'location') {
    const location = message.location;
    if (!location) {
      return null;
    }

    const parts = [location.name,location.address,].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(' - ');
    }

    if (location.latitude !== undefined && location.longitude !== undefined ) {
      return `${location.latitude}, ${location.longitude}`;
    }
    return null;
  }

  return null;
}


function resolveWhatsAppMimeType(message: WhatsAppTextMessage,): string | null {
  switch (String(message.type ?? '',).toLowerCase()) {
    case 'image':
      return message.image?.mime_type ?? null;
    case 'video':
      return message.video?.mime_type ?? null;
    case 'audio':
      return message.audio?.mime_type ?? null;
    case 'document':
      return message.document?.mime_type ?? null;
    case 'sticker':
      return message.sticker?.mime_type ?? null;
    default:
      return null;
  }
}


function resolveWhatsAppMediaId(message: WhatsAppTextMessage,): string | null {
  switch (String(message.type ?? '',).toLowerCase()) {
    case 'image':
      return message.image?.id ?? null;
    case 'video':
      return message.video?.id ?? null;
    case 'audio':
      return message.audio?.id ?? null;
    case 'document':
      return message.document?.id ?? null;
    case 'sticker':
      return message.sticker?.id ?? null;
    default:
      return null;
  }
}


async function processWhatsAppStatus(status: WhatsAppStatus,) {
  const externalMessageId = status.id;
  if (!externalMessageId) {
    console.log('Skipping WhatsApp status without message ID',);
    return;
  }

  const mappedStatus = mapWhatsAppStatus(status.status,);
  if (!mappedStatus) {
    console.log(`Ignoring unsupported WhatsApp status: ${status.status ?? 'unknown'}`,);
    return;
  }

  const existingMessage =
    await prisma.message.findFirst({
      where: {
        externalMessageId,
      },
    });

  if (!existingMessage) {
    console.log(`Outbound message not found for Meta status: ${externalMessageId}`,);

    return;
  }

  const statusRank:
    Record<string, number> = {
      QUEUED: 0,
      SENT: 1,
      DELIVERED: 2,
      READ: 3,
      FAILED: 4,
    };

  const currentRank = statusRank[existingMessage.status] ?? 0;
  const incomingRank = statusRank[mappedStatus] ?? 0;
  if (mappedStatus !== 'FAILED' && existingMessage.status !== 'FAILED' && incomingRank < currentRank ) {
    console.log(`Ignoring status regression ${existingMessage.status} -> ${mappedStatus}`,);
    return;
  }

  if (existingMessage.status === mappedStatus ) {
    return;
  }

  const updatedMessage =
    await prisma.message.update({
      where: {
        id: existingMessage.id,
      },

      data: {
        status: mappedStatus,
        metadata: {
          provider: 'META',
          ...(
            typeof existingMessage.metadata === 'object' &&
            existingMessage.metadata !== null &&
            !Array.isArray(
              existingMessage.metadata,
            )
              ? existingMessage.metadata
              : {}
          ),

          lastStatusWebhook: toPrismaJson(status,),
        },
      },
    });

  emitToOrganization(existingMessage.organizationId,'message.status.updated',updatedMessage,);
  emitToConversation(existingMessage.conversationId,'message.status.updated',updatedMessage,);
}


async function processWhatsAppMessage(value: WhatsAppValue,incomingMessage: WhatsAppTextMessage) {
  const phoneNumberId = value.metadata?.phone_number_id;
  const externalMessageId = incomingMessage.id;
  const senderExternalId = incomingMessage.from;
  console.log('Processing inbound WhatsApp message',);

  if (!phoneNumberId) {
    throw new Error('Inbound WhatsApp webhook is missing metadata.phone_number_id',);
  }

  if (!externalMessageId) {
    throw new Error('Inbound WhatsApp webhook is missing message.id',);
  }

  if (!senderExternalId) {
    throw new Error('Inbound WhatsApp webhook is missing message.from',);
  }

  const channelAccount =
    await prisma.channelAccount.findFirst({
      where: {
        channel: 'WHATSAPP',
        phoneNumberId,
        status: 'ACTIVE',
      },
    });

  if (!channelAccount) {
    throw new Error(`Active WhatsApp ChannelAccount not found for phoneNumberId ${phoneNumberId}`,);
  }

  const organizationId = channelAccount.organizationId;
  const duplicateMessage =
    await prisma.message.findFirst({
      where: {
        organizationId,
        externalMessageId,
      },
    });

  if (duplicateMessage) {
    console.log(`Inbound WhatsApp message already exists: ${externalMessageId}`,);
    return duplicateMessage;
  }

  const webhookContact = value.contacts?.find(contact => contact.wa_id === senderExternalId) ?? value.contacts?.[0];
  const displayName = webhookContact?.profile?.name?.trim() ||  senderExternalId;
  let identity =
    await prisma.contactIdentity.findUnique({
      where: {
        organizationId_channel_externalId: {
          organizationId,
          channel: 'WHATSAPP',
          externalId: senderExternalId,
        },
      },

      include: {
        contact: true,
      },
    });

  let contact;

  if (identity) {
    contact =
      await prisma.contact.update({
        where: {
          id: identity.contact.id,
        },

        data: {
          phone: identity.contact.phone ?? senderExternalId,
          displayName: displayName || identity.contact.displayName,
        },
      });

    await prisma.contactIdentity.update({
      where: {
        id: identity.id,
      },

      data: {
        phone: senderExternalId,
        metadata: {
          provider: 'META',
          profileName: displayName,
          webhookContact: webhookContact? toPrismaJson(webhookContact,): null,
        },
      },
    });
  } else {
    const result =
      await prisma.$transaction(
        async transaction => {
          const createdContact =
            await transaction.contact.create({
              data: {
                organizationId,
                displayName,
                phone: senderExternalId,
                status: 'ACTIVE',

                attributes: {
                  source: 'META',
                  channel: 'WHATSAPP',
                },
              },
            });

          const createdIdentity =
            await transaction.contactIdentity.create({
              data: {
                organizationId,

                contactId: createdContact.id,
                channel: 'WHATSAPP',
                externalId: senderExternalId,
                phone: senderExternalId,
                metadata: {
                  provider: 'META',
                  profileName: displayName,
                  webhookContact: webhookContact? toPrismaJson(webhookContact): null,
                },
              },
            });

          return {
            contact: createdContact,
            identity: createdIdentity,
          };
        },
      );

    contact = result.contact;
  }

  const inbox =
    await prisma.inbox.findFirst({
      where: {
        organizationId,
        channelAccountId: channelAccount.id,
        status: 'ACTIVE',
      },

      orderBy: {
        createdAt: 'asc',
      },
    });

  let conversation =
    await prisma.conversation.findFirst({
      where: {
        organizationId,
        contactId: contact.id,
        channel: 'WHATSAPP',
        channelAccountId: channelAccount.id,
        status: {
          in: ['OPEN','PENDING',],
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

  let conversationCreated = false;
  if (!conversation) {
    conversation =
      await prisma.conversation.create({
        data: {
          organizationId,
          contactId: contact.id,
          channelAccountId: channelAccount.id,
          inboxId: inbox?.id ?? null,
          channel: 'WHATSAPP',
          status: 'OPEN',
          priority: 'NORMAL',
          openedAt: new Date(),
        },
      });

    conversationCreated = true;
    await prisma.conversationEvent.create({
      data: {
        organizationId,
        conversationId: conversation.id,
        actorUserId: null,
        type: 'CREATED',
        metadata: {
          provider: 'META',
          channel: 'WHATSAPP',
        },
      },
    });
  } else if ( !conversation.inboxId && inbox) {
    conversation =
      await prisma.conversation.update({
        where: {
          id: conversation.id,
        },

        data: {
          inboxId: inbox.id,
        },
      });
  }

  const messageType = resolveWhatsAppMessageType(incomingMessage.type);
  const body = resolveWhatsAppMessageBody(incomingMessage);
  const mimeType = resolveWhatsAppMimeType(incomingMessage);
  const mediaId = resolveWhatsAppMediaId(incomingMessage);

  let replyToMessageId: string | null = null;
  if (incomingMessage.context?.id) {
    const replyMessage =
      await prisma.message.findFirst({
        where: {
          organizationId,
          conversationId: conversation.id,
          externalMessageId: incomingMessage.context.id,
        },
        select: {
          id: true,
        },
      });
    replyToMessageId = replyMessage?.id ?? null;
  }

  const createdMessage =
    await prisma.$transaction(
      async transaction => {
        const message =
          await transaction.message.create({
            data: {
              organizationId,
              conversationId: conversation.id,
              contactId: contact.id,
              senderUserId: null,
              direction: 'INBOUND',
              type: messageType,
              body,
              mediaUrl: null,
              mimeType,
              externalMessageId,
              replyToMessageId,
              status: 'RECEIVED',
              metadata: {
                provider: 'META',
                channel: 'WHATSAPP',
                phoneNumberId,
                senderExternalId,
                mediaId,
                whatsappType: incomingMessage.type ?? null,
                raw: toPrismaJson(incomingMessage),
              },
            },
          });

        await transaction.conversation.update({
          where: {
            id: conversation.id,
          },
          data: {
            lastMessageAt: message.createdAt,
          },
        });

        await transaction.conversationEvent.create({
          data: {
            organizationId,
            conversationId: conversation.id,
            actorUserId: null,
            type: 'MESSAGE_RECEIVED',
            metadata: {
              provider: 'META',
              channel: 'WHATSAPP',
              externalMessageId,
            },
          },
        });
        return message;
      },
    );

  if (conversationCreated) {
    emitToOrganization(organizationId,'conversation.created',conversation,);
  }

  emitToOrganization(organizationId,'message.created',createdMessage,);
  emitToConversation(conversation.id,'message.created',createdMessage,);
  emitToOrganization(organizationId,
    'conversation.updated',
    {
      ...conversation,
      lastMessageAt: createdMessage.createdAt,
    },
  );
  return createdMessage;
}

async function processWhatsAppChange(change: WhatsAppChange) {
  if (change.field !== 'messages') {
    console.log(`Ignoring Meta change field: ${change.field ?? 'unknown'}`,);
    return;
  }

  const value = change.value;
  if (!value) {
    return;
  }

  if (Array.isArray(value.messages,)) {
    for (const incomingMessage of value.messages ) {
      await processWhatsAppMessage(value,incomingMessage);
    }
  }

  if (Array.isArray(value.statuses)) {
    for (const status of value.statuses ) {
      await processWhatsAppStatus(status);
    }
  }
}


async function processWhatsAppWebhook(payload: WhatsAppWebhookPayload) {
  const entries = Array.isArray(payload.entry,) ? payload.entry : [];
  console.log(`WhatsApp webhook entries: ${entries.length}`,);
  for (const entry of entries ) {
    const changes = Array.isArray(entry.changes, ) ? entry.changes : [];
    for (const change of changes ) {
      await processWhatsAppChange(change);
    }
  }
}
 

function resolveMessengerMessageType(message: MessengerMessage,): MessageType {
  const attachment = message.attachments?.[0];
  if (!attachment) {
    return MessageType.TEXT;
  }

  switch (String(attachment.type ?? '',).toLowerCase()) {
    case 'image':
      if (attachment.payload?.sticker_id) {
        return MessageType.STICKER;
      }
      return MessageType.IMAGE;
    case 'video':
      return MessageType.VIDEO;
    case 'audio':
      return MessageType.AUDIO;
    case 'file':
      return MessageType.DOCUMENT;
    case 'location':
      return MessageType.LOCATION;
    default:
      return MessageType.TEXT;
  }
}


function resolveMessengerBody(message: MessengerMessage,): string | null {
  if ( typeof message.text === 'string' && message.text.trim()) {
    return message.text.trim();
  }

  const attachment = message.attachments?.[0];
  if (!attachment) {
    return null;
  }

  if (attachment.type === 'location') {
    const coordinates = attachment.payload?.coordinates;
    if (coordinates?.lat !== undefined && coordinates?.long !== undefined ) {
      return `${coordinates.lat}, ${coordinates.long}`;
    }
  }

  if (attachment.type === 'file') {
    return 'Facebook attachment';
  }

  return null;
}


function resolveMessengerMediaUrl(message: MessengerMessage): string | null {
  const attachment = message.attachments?.[0];
  const url = attachment?.payload?.url;
  return (typeof url === 'string' && url.trim() ? url.trim() : null);
}



async function getMessengerProfile(
  psid: string,
  accessToken: string,
): Promise<{
  firstName: string | null;
  lastName: string | null;
  displayName: string;
}> {
  const graphVersion = process.env.META_GRAPH_VERSION ?? 'v26.0';
  try {
    const url = new URL(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(psid)}`);
    url.searchParams.set('fields','first_name,last_name,name');
    const response =
      await fetch(
        url.toString(),
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          signal: AbortSignal.timeout(10000),
        },
      );

    if (!response.ok) {
      console.warn('Unable to load Messenger profile:',response.status);
      return {
        firstName: null,
        lastName: null,
        displayName: psid,
      };
    }

    const result =
      await response.json() as {
        first_name?: string;
        last_name?: string;
        name?: string;

        error?: {
          message?: string;
        };
      };

    const firstName = result.first_name?.trim() || null;
    const lastName = result.last_name?.trim() || null;

    const displayName = 
      result.name?.trim() ||
      [
        firstName,
        lastName,
      ]
        .filter(Boolean)
        .join(' ')
        .trim() ||
      psid;

    return {
      firstName,
      lastName,
      displayName,
    };
  } catch (error) {
    console.warn(
      'Messenger profile request failed:',
      getErrorMessage(error),
    );

    return {
      firstName: null,
      lastName: null,
      displayName: psid,
    };
  }
}

async function resolveMessengerContact(
  organizationId: string,
  senderPsid: string,
  accessToken: string,
) {
  let identity =
    await prisma.contactIdentity.findUnique({
      where: {
        organizationId_channel_externalId: {
          organizationId,
          channel: 'FACEBOOK',
          externalId: senderPsid,
        },
      },

      include: {
        contact: true,
      },
    });

  if (identity) {
    return {
      contact: identity.contact,
      identity,
    };
  }

  const profile = await getMessengerProfile(senderPsid,accessToken);

  const result =
    await prisma.$transaction(
      async transaction => {
        const contact =
          await transaction.contact.create({
            data: {
              organizationId,
              displayName: profile.displayName,
              firstName: profile.firstName,
              lastName: profile.lastName,
              status: 'ACTIVE',
              attributes: {
                source: 'META',
                channel: 'FACEBOOK',
              },
            },
          });

        const createdIdentity =
          await transaction.contactIdentity.create({
            data: {
              organizationId,
              contactId: contact.id,
              channel: 'FACEBOOK',
              externalId: senderPsid,
              metadata: {
                provider: 'META',
                platform: 'MESSENGER',
                profile: toPrismaJson(profile),
              },
            },
          });

        return {
          contact,
          identity: createdIdentity,
        };
      },
    );

  return result;
}
 
async function resolveMessengerConversation(organizationId: string,contactId: string,channelAccountId: string) {
  const inbox =
    await prisma.inbox.findFirst({
      where: {
        organizationId,
        channelAccountId,
        status: 'ACTIVE',
      },

      orderBy: {
        createdAt: 'asc',
      },
    });

  let conversation =
    await prisma.conversation.findFirst({
      where: {
        organizationId,
        contactId,
        channel: 'FACEBOOK',
        channelAccountId,
        status: {
          in: ['OPEN','PENDING'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

  let created = false;
  if (!conversation) {
    conversation =
      await prisma.conversation.create({
        data: {
          organizationId,
          contactId,
          channelAccountId,
          inboxId: inbox?.id ??null,
          channel: 'FACEBOOK',
          status: 'OPEN',
          priority: 'NORMAL',
          openedAt: new Date(),
        },
      });

    created = true;
    await prisma.conversationEvent.create({
      data: {
        organizationId,
        conversationId: conversation.id,
        actorUserId: null,
        type: 'CREATED',
        metadata: {
          provider: 'META',
          channel: 'FACEBOOK',
        },
      },
    });
  } else if (!conversation.inboxId && inbox ) {
    conversation =
      await prisma.conversation.update({
        where: {
          id: conversation.id,
        },

        data: {
          inboxId: inbox.id,
        },
      });
  }

  return {
    conversation,
    created,
  };
}

async function processMessengerMessage(pageId: string,event: MessengerMessagingEvent,) {
  const senderPsid = event.sender?.id;
  const message = event.message;
  if (!senderPsid) {
    console.log('Skipping Messenger event without sender PSID',);
    return;
  }

  if (!message) {
    return;
  }
 
  if (message.is_echo) {
    console.log('Ignoring Messenger echo event',);
    return;
  }

  const externalMessageId = message.mid;
  if (!externalMessageId) {
    console.log('Skipping Messenger message without mid',);
    return;
  }

  const channelAccount =
    await prisma.channelAccount.findFirst({
      where: {
        channel: 'FACEBOOK',
        pageId,
        status: 'ACTIVE',
      },
    });

  if (!channelAccount) {
    throw new Error(
      `Active Facebook ChannelAccount not found for pageId ${pageId}`,
    );
  }

  const organizationId = channelAccount.organizationId;
  const duplicate =
    await prisma.message.findFirst({
      where: {
        organizationId,
        externalMessageId,
      },
    });

  if (duplicate) {
    console.log(`Messenger message already exists: ${externalMessageId}`,);
    return duplicate;
  }

  const {contact} =
    await resolveMessengerContact(
      organizationId,
      senderPsid,
      channelAccount.accessToken,
    );

  const {
    conversation,
    created: conversationCreated,
  } =
    await resolveMessengerConversation(
      organizationId,
      contact.id,
      channelAccount.id,
    );

  const type = resolveMessengerMessageType(message);
  const body = resolveMessengerBody(message);
  const mediaUrl = resolveMessengerMediaUrl(message);
  let replyToMessageId: string | null = null;

  if (message.reply_to?.mid) {
    const replyMessage =
      await prisma.message.findFirst({
        where: {
          organizationId,
          conversationId: conversation.id,
          externalMessageId: message.reply_to.mid,
        },

        select: {
          id: true,
        },
      });

    replyToMessageId = replyMessage?.id ?? null;
  }

  const createdMessage =
    await prisma.$transaction(
      async transaction => {
        const dbMessage =
          await transaction.message.create({
            data: {
              organizationId,
              conversationId: conversation.id,
              contactId: contact.id,
              senderUserId: null,
              direction: 'INBOUND',
              type,
              body,
              mediaUrl,
              mimeType: null,
              externalMessageId,
              replyToMessageId,
              status: 'RECEIVED',
              metadata: {
                provider: 'META',
                channel: 'FACEBOOK',
                platform: 'MESSENGER',
                pageId,
                senderPsid,
                raw: toPrismaJson(event),
              },
            },
          });

        await transaction.conversation.update({
          where: {
            id: conversation.id,
          },

          data: {
            lastMessageAt: dbMessage.createdAt,
          },
        });

        await transaction.conversationEvent.create({
          data: {
            organizationId,
            conversationId: conversation.id,
            actorUserId: null,
            type: 'MESSAGE_RECEIVED',
            metadata: {
              provider: 'META',
              channel: 'FACEBOOK',
              externalMessageId,
            },
          },
        });

        return dbMessage;
      },
    );

  console.log('FACEBOOK MESSENGER MESSAGE CREATED',);

  console.log('Message ID:',createdMessage.id,);

  console.log('Conversation ID:',conversation.id,);

  console.log('Facebook PSID:',senderPsid,);

  if (conversationCreated) {
    emitToOrganization(
      organizationId,
      'conversation.created',
      conversation,
    );
  }

  emitToOrganization(organizationId,'message.created',createdMessage,);

  emitToConversation(conversation.id,'message.created',createdMessage,);

  emitToOrganization(organizationId,'conversation.updated',{
      ...conversation,
      lastMessageAt: createdMessage.createdAt,
    },
  );

  return createdMessage;
}

 

async function processMessengerDelivery(pageId: string, event: MessengerMessagingEvent) {
  const mids = event.delivery?.mids ?? [];
  if (mids.length === 0) {
    return;
  }

  const channelAccount =
    await prisma.channelAccount.findFirst({
      where: {
        channel: 'FACEBOOK',
        pageId,
        status: 'ACTIVE',
      }, 
      select: {
        organizationId: true,
      },
    });

  if (!channelAccount) {
    return;
  }

  for (const externalMessageId of mids ) {
    const existingMessage =
      await prisma.message.findFirst({
        where: {
          organizationId: channelAccount.organizationId,
          externalMessageId,
        },
      });

    if (!existingMessage) {
      continue;
    }

    if (existingMessage.status === 'DELIVERED' || existingMessage.status === 'READ') {
      continue;
    }

    const updated =
      await prisma.message.update({
        where: {
          id: existingMessage.id,
        },

        data: {
          status: 'DELIVERED',
          metadata: {
            provider: 'META',
            ...(
              typeof existingMessage.metadata === 'object' &&
              existingMessage.metadata !== null && !Array.isArray(existingMessage.metadata) ? existingMessage.metadata : {}
            ),

            messengerDelivery: toPrismaJson(event.delivery),
          },
        },
      });

    emitToOrganization(
      existingMessage.organizationId,
      'message.status.updated',
      updated,
    );

    emitToConversation(
      existingMessage.conversationId,
      'message.status.updated',
      updated,
    );
  }
}
 
async function processMessengerRead(pageId: string,event: MessengerMessagingEvent) {
  const senderPsid = event.sender?.id;
  const watermark = event.read?.watermark;
  if (!senderPsid || !watermark) {
    return;
  }

  const channelAccount =
    await prisma.channelAccount.findFirst({
      where: {
        channel: 'FACEBOOK',
        pageId,
        status: 'ACTIVE',
      },
    });

  if (!channelAccount) {
    return;
  }

  const identity =
    await prisma.contactIdentity.findUnique({
      where: {
        organizationId_channel_externalId: {
          organizationId: channelAccount.organizationId,
          channel: 'FACEBOOK',
          externalId: senderPsid,
        },
      },
    });

  if (!identity) {
    return;
  }

  const conversation =
    await prisma.conversation.findFirst({
      where: {
        organizationId: channelAccount.organizationId,
        contactId: identity.contactId,
        channel: 'FACEBOOK',
        channelAccountId: channelAccount.id,
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

  if (!conversation) {
    return;
  }

  const readDate = new Date(watermark,);
  const messages =
    await prisma.message.findMany({
      where: {
        organizationId: channelAccount.organizationId,
        conversationId: conversation.id,
        direction: 'OUTBOUND',
        status: {
          in: ['QUEUED','SENT','DELIVERED'],
        },

        createdAt: {
          lte:
            readDate,
        },
      },
    });

  for (const message of messages ) {
    const updated =
      await prisma.message.update({
        where: {
          id: message.id,
        },

        data: {
          status: 'READ',
          metadata: {
            provider: 'META',
            ...(
              typeof message.metadata === 'object' &&
              message.metadata !== null && !Array.isArray(message.metadata,)? message.metadata: {}),
            messengerRead: toPrismaJson(event.read),
          },
        },
      });

    emitToOrganization(
      message.organizationId,
      'message.status.updated',
      updated,
    );

    emitToConversation(
      message.conversationId,
      'message.status.updated',
      updated,
    );
  }
}


async function processMessengerPostback(
  pageId: string,
  event: MessengerMessagingEvent,
) {
  const senderPsid = event.sender?.id;
  const postback = event.postback;
  if (!senderPsid ||!postback) {
    return;
  }

  const channelAccount =
    await prisma.channelAccount.findFirst({
      where: {
        channel: 'FACEBOOK',
        pageId,
        status: 'ACTIVE',
      },
    });

  if (!channelAccount) {
    throw new Error(
      `Active Facebook ChannelAccount not found for pageId ${pageId}`,
    );
  }

  const {
    contact,
  } =
    await resolveMessengerContact(
      channelAccount.organizationId,
      senderPsid,
      channelAccount.accessToken,
    );

  const {
    conversation,
    created: conversationCreated,
  } =
    await resolveMessengerConversation(
      channelAccount.organizationId,
      contact.id,
      channelAccount.id,
    );

  const externalMessageId =
    postback.mid ??
    `postback:${pageId}:${senderPsid}:${event.timestamp ?? Date.now()}`;

  const duplicate =
    await prisma.message.findFirst({
      where: {
        organizationId: channelAccount.organizationId,
        externalMessageId,
      },
    });

  if (duplicate) {
    return;
  }

  const body =
    postback.title ??
    postback.payload ??
    'Messenger postback';

  const createdMessage =
    await prisma.$transaction(
      async transaction => {
        const message =
          await transaction.message.create({
            data: {
              organizationId: channelAccount.organizationId,
              conversationId: conversation.id,
              contactId: contact.id,
              senderUserId: null,
              direction: 'INBOUND',
              type: 'INTERACTIVE',
              body,
              externalMessageId,
              status: 'RECEIVED',
              metadata: {
                provider: 'META',
                channel: 'FACEBOOK',
                platform: 'MESSENGER',
                pageId,
                senderPsid,
                postback: toPrismaJson(postback),
                raw: toPrismaJson(event),
              },
            },
          });

        await transaction.conversation.update({
          where: {
            id: conversation.id,
          },

          data: {
            lastMessageAt: message.createdAt,
          },
        });

        await transaction.conversationEvent.create({
          data: {
            organizationId: channelAccount.organizationId,
            conversationId: conversation.id,
            actorUserId: null,
            type: 'MESSAGE_RECEIVED',
            metadata: {
              provider: 'META',
              channel: 'FACEBOOK',
              event: 'POSTBACK',
            },
          },
        });

        return message;
      },
    );

  if (conversationCreated) {
    emitToOrganization(
      channelAccount.organizationId,
      'conversation.created',
      conversation,
    );
  }

  emitToOrganization(
    channelAccount.organizationId,
    'message.created',
    createdMessage,
  );

  emitToConversation(
    conversation.id,
    'message.created',
    createdMessage,
  );

  emitToOrganization(
    channelAccount.organizationId,
    'conversation.updated',
    {
      ...conversation,
      lastMessageAt: createdMessage.createdAt,
    },
  );
}


async function processMessengerEvent(pageId: string,event: MessengerMessagingEvent) {
  if (event.message) {
    await processMessengerMessage(
      pageId,
      event,
    );
    return;
  }

  if (event.delivery) {
    await processMessengerDelivery(
      pageId,
      event,
    );
    return;
  }

  if (event.read) {
    await processMessengerRead(
      pageId,
      event,
    );
    return;
  }

  if (event.postback) {
    await processMessengerPostback(
      pageId,
      event,
    );
    return;
  }

  console.log('Ignoring unsupported Messenger event',);
}
 
async function processMessengerWebhook(payload: MessengerWebhookPayload) {
  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  console.log(`Messenger webhook entries: ${entries.length}`,);
  for (const entry of entries ) { 
    const pageId = entry.id;
    if (!pageId) {
      console.warn('Skipping Messenger entry without Page ID',);
      continue;
    }

    const events = Array.isArray(entry.messaging,)? entry.messaging: [];
    console.log(`Messenger events for page ${pageId}: ${events.length}`,);
    for (const event of events ) {
      await processMessengerEvent(pageId,event);
    }
  }
}

async function processMetaWebhookOldest(payload: MetaWebhookPayload) {
  console.log('Meta webhook object:',payload.object ??'unknown');
  switch (payload.object) {
    case 'whatsapp_business_account':
      await processWhatsAppWebhook(payload as WhatsAppWebhookPayload);
      return;
    case 'page':
      await processMessengerWebhook(payload as MessengerWebhookPayload);
      return;
    default:
      console.log(`Ignoring unsupported Meta webhook object: ${payload.object ??'unknown'}`,
      );
  }
}

async function processMetaWebhook(payload: MetaWebhookPayload,) {
  console.log('Meta webhook object:',payload.object ?? 'unknown',);

  switch (payload.object) {
    case 'whatsapp_business_account':
      await processWhatsAppWebhook(
        payload as WhatsAppWebhookPayload,
      );
      return;

    case 'page':
      await processMessengerWebhook(
        payload as MessengerWebhookPayload,
      );
      return;

    case 'instagram':
      await processInstagramWebhook(
        payload as InstagramWebhookPayload,
      );
      return;

    default:
      console.log(
        `Ignoring unsupported Meta webhook object: ${
          payload.object ?? 'unknown'
        }`,
      );
  }
}

export function startMetaWorker() {
  if (metaWorker) {
    console.log('Meta worker already running',);
    return metaWorker;
  }

  const redisHost = process.env.REDIS_HOST ?? '127.0.0.1';
  const redisPort = Number(process.env.REDIS_PORT ?? 6379);
  console.log(`Starting Meta worker on queue: ${META_QUEUE_NAME}`,);

  console.log(`Meta Worker Redis: ${redisHost}:${redisPort}`,);

  metaWorker =
    new Worker<MetaWebhookJobData>(
      META_QUEUE_NAME,
      async (job: Job<MetaWebhookJobData>,) => {
        console.log('\n========================================',);
        console.log('META WEBHOOK JOB STARTED',);
        console.log('Job ID:',job.id,);
        console.log('Receipt ID:',job.data.receiptId,);

        try {
          const receipt =
            await prisma.webhookReceipt.findUnique({
              where: {
                id: job.data.receiptId,
              },
            });

          if (!receipt) {
            throw new Error(`WebhookReceipt not found: ${job.data.receiptId}`,);
          }

          if (receipt.processedAt) {
            console.log('Webhook receipt already processed:',receipt.id,);
            return {
              success: true,
              duplicate: true,
              receiptId: receipt.id,
            };
          }

          const payload = receipt.payload as unknown as MetaWebhookPayload;
          console.log('Payload object:',payload?.object,);
          await processMetaWebhook(payload);
          await prisma.webhookReceipt.update({
            where: {
              id: receipt.id,
            },

            data: {
              processedAt: new Date(),
            },
          });

          console.log('Webhook receipt marked as processed',);
          console.log('META WEBHOOK JOB COMPLETED',);
          console.log('========================================\n',);
          return {
            success: true,
            receiptId: receipt.id,
          };
        } catch (error) {
          console.error('META WORKER JOB ERROR:',error,);
          console.log('========================================\n',);
          throw error;
        }
      },

      {
        connection: {
          host: redisHost,
          port: redisPort,
          maxRetriesPerRequest: null,
        },
      },
    );

  metaWorker.on('ready',() => {console.log('Meta worker ready',);},);
  metaWorker.on('completed',job => {console.log(`Meta job completed: ${job.id}`,);},);
  metaWorker.on('failed',(job,error,) => {console.error(`Meta job failed: ${job?.id ??'unknown'}`,error,);},);
  metaWorker.on('error',error => {console.error('Meta worker error:',error.message,);},);
  return metaWorker;
}

export async function stopMetaWorker() {
  if (!metaWorker) {
    return;
  }

  console.log('Closing Meta worker...',);
  await metaWorker.close();
  metaWorker = null;
  console.log('Meta worker closed',);
}