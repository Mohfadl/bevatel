import 'dotenv/config';

import {MessageType, Prisma,} from '../../../../generated/prisma/client';
import {prisma,} from '../../../../shared/prisma';
import {emitToConversation,emitToOrganization,} from '../../../realtime/socket';

type InstagramUser = {id?: string;};

type InstagramAttachment = {
  type?: string;
  payload?: {
    url?: string;
    coordinates?: {
      lat?: number;
      long?: number;
    };
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

type InstagramMessage = {
  mid?: string;
  text?: string;
  attachments?: InstagramAttachment[];
  reply_to?: {
    mid?: string;
  };
  is_echo?: boolean;
  [key: string]: unknown;
};

type InstagramDelivery = {
  mids?: string[];
  watermark?: number;
  [key: string]: unknown;
};

type InstagramRead = {
  watermark?: number;
  [key: string]: unknown;
};

type InstagramPostback = {
  title?: string;
  payload?: string;
  mid?: string;
  [key: string]: unknown;
};

type InstagramMessagingEvent = {
  sender?: InstagramUser;
  recipient?: InstagramUser;
  timestamp?: number;
  message?: InstagramMessage;
  delivery?: InstagramDelivery;
  read?: InstagramRead;
  postback?: InstagramPostback;
  [key: string]: unknown;
};

type InstagramEntry = {
  id?: string;
  time?: number;
  messaging?: InstagramMessagingEvent[];
  [key: string]: unknown;
};

export type InstagramWebhookPayload = {
  object?: string;
  entry?: InstagramEntry[];
  [key: string]: unknown;
};

function toPrismaJson(value: unknown,): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value),) as Prisma.InputJsonValue;
}


function getErrorMessage(error: unknown,): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}


function resolveInstagramMessageType(message: InstagramMessage,): MessageType {
  const attachment = message.attachments?.[0];
  if (!attachment) {
    return MessageType.TEXT;
  }

  switch (String(attachment.type ?? '', ).toLowerCase()) {
    case 'image':
      return MessageType.IMAGE;
    case 'video':
      return MessageType.VIDEO;
    case 'audio':
      return MessageType.AUDIO;
    case 'file':
      return MessageType.DOCUMENT;
    case 'location':
      return MessageType.LOCATION;
    case 'share':
      return MessageType.INTERACTIVE;
    case 'story_mention':
      return MessageType.INTERACTIVE;
    default:
      return MessageType.TEXT;
  }
}

function resolveInstagramMessageBody(message: InstagramMessage,): string | null {
  if (typeof message.text === 'string' && message.text.trim()) {
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

  switch (String( attachment.type ?? '',).toLowerCase()) {
    case 'image':
      return 'Instagram image';
    case 'video':
      return 'Instagram video';
    case 'audio':
      return 'Instagram audio';
    case 'file':
      return 'Instagram attachment';
    case 'share':
      return 'Instagram shared content';
    case 'story_mention':
      return 'Instagram story mention';
    default:
      return null;
  }
}

function resolveInstagramMediaUrl(message: InstagramMessage,): string | null 
{
  const attachment = message.attachments?.[0];
  const url = attachment?.payload?.url;
  if (typeof url === 'string' && url.trim() ) {
    return url.trim();
  }
  return null;
}

async function resolveInstagramChannelAccount(entryId: string,recipientId?: string,) 
{
  const possibleIds = [entryId,recipientId,].filter((value,): value is string => typeof value === 'string' && value.trim().length > 0);
  const uniqueIds = [...new Set(possibleIds)];
  console.log('Resolving Instagram ChannelAccount',{
      entryId,
      recipientId: recipientId ?? null,
      possibleIds: uniqueIds,
    },
  );

  let channelAccount =
    await prisma
      .channelAccount
      .findFirst({
        where: {
          channel: 'INSTAGRAM',
          status: 'ACTIVE',
          instagramAccountId: {
            in: uniqueIds,
          },
        },
      });

  if (channelAccount) {
    return channelAccount;
  }

  channelAccount = await prisma
      .channelAccount
      .findFirst({
        where: {
          channel: 'INSTAGRAM',
          status: 'ACTIVE',
          externalAccountId: {in: uniqueIds,},
        },
      });

  if (channelAccount) {
    console.warn('Instagram ChannelAccount matched by externalAccountId instead of instagramAccountId',{
        channelAccountId: channelAccount.id,
        entryId,
        recipientId: recipientId ?? null,
      },
    );

    return channelAccount;
  }
 
  const configuredAccounts =
    await prisma
      .channelAccount
      .findMany({
        where: {
          channel: 'INSTAGRAM',
          status: 'ACTIVE',
        },

        select: {
          id: true,
          organizationId: true,
          name: true,
          instagramAccountId: true,
          externalAccountId: true,
        },
      });

  console.error('Unable to match Instagram webhook to ChannelAccount',{
      entryId,
      recipientId: recipientId ?? null,
      configuredAccounts:
        configuredAccounts.map(
          account => ({
            id: account.id,
            name: account.name,
            instagramAccountId: account.instagramAccountId,
            externalAccountId: account.externalAccountId,
          }),
        ),
    },
  );

  return null;
}

async function getInstagramProfile(
  instagramScopedUserId: string,
  accessToken: string,
): Promise<{
  username: string | null;
  name: string | null;
  displayName: string;
}> {
  const graphVersion = process.env.META_GRAPH_VERSION ?? 'v26.0';
  try {
    const url = new URL(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(instagramScopedUserId,)}`,);
    url.searchParams.set('fields','name,username',);
    const response =
      await fetch(
        url.toString(),
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          signal: AbortSignal.timeout(10000,),
        },
      );

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '',);
      console.warn('Unable to load Instagram profile',{
          instagramScopedUserId,
          status: response.status,
          response: errorBody.slice(0,500,),
        },
      );

      return {
        username: null,
        name: null,
        displayName: instagramScopedUserId,
      };
    }

    const result =
      await response.json() as {
        id?: string;
        username?: string;
        name?: string;
        error?: {message?: string;};
      };

    const username = result.username?.trim() || null;
    const name = result.name?.trim() || null;
    const displayName = name || (username ? `@${username}` : instagramScopedUserId);

    return {
      username,
      name,
      displayName,
    };
  } catch (error) {
    console.warn('Instagram profile request failed',{
        instagramScopedUserId,
        error: getErrorMessage(error,),
      },
    );

    return {
      username: null,
      name: null,
      displayName: instagramScopedUserId,
    };
  }
}


async function resolveInstagramContact(
  organizationId: string,
  senderExternalId: string,
  accessToken: string,
) {
  let identity =
    await prisma
      .contactIdentity
      .findUnique({
        where: {
          organizationId_channel_externalId: {
            organizationId,
            channel: 'INSTAGRAM',
            externalId: senderExternalId,
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

  const profile =
    await getInstagramProfile(
      senderExternalId,
      accessToken,
    );

  const result =
    await prisma
      .$transaction(
        async transaction => {
          const contact =
            await transaction
              .contact
              .create({
                data: {
                  organizationId,
                  displayName: profile.displayName,
                  status: 'ACTIVE',
                  attributes: {
                    source: 'META',
                    channel: 'INSTAGRAM',
                    instagramScopedUserId:
                      senderExternalId,
                  },
                },
              });

          const createdIdentity =
            await transaction
              .contactIdentity
              .create({
                data: {
                  organizationId,
                  contactId: contact.id,
                  channel: 'INSTAGRAM',
                  externalId: senderExternalId,
                  username: profile.username,
                  metadata: {
                    provider: 'META',
                    platform: 'INSTAGRAM',
                    profile: toPrismaJson(profile,),
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


async function resolveInstagramConversation(
  organizationId: string,
  contactId: string,
  channelAccountId: string,
) {
  const inbox =
    await prisma
      .inbox
      .findFirst({
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
    await prisma
      .conversation
      .findFirst({
        where: {
          organizationId,
          contactId,
          channel: 'INSTAGRAM',
          channelAccountId,

          status: {
            in: [
              'OPEN',
              'PENDING',
            ],
          },
        },

        orderBy: {
          createdAt: 'desc',
        },
      });

  let created = false;

  if (!conversation) {
    conversation =
      await prisma
        .conversation
        .create({
          data: {
            organizationId,
            contactId,
            channelAccountId,
            inboxId: inbox?.id ?? null,
            channel: 'INSTAGRAM',
            status: 'OPEN',
            priority: 'NORMAL',
            openedAt: new Date(),
          },
        });

    created = true;
    await prisma
      .conversationEvent
      .create({
        data: {
          organizationId,
          conversationId: conversation.id,
          actorUserId: null,
          type: 'CREATED',
          metadata: {
            provider:'META',
            channel: 'INSTAGRAM',
          },
        },
      });
  } else if (
    !conversation.inboxId &&
    inbox
  ) {
    conversation =
      await prisma
        .conversation
        .update({
          where: {
            id: conversation.id,
          },
          data: {
            inboxId: inbox.id,
          },
        });
  }

  return {
    conversation, created,
  };
}
 

async function processInstagramMessage(instagramAccountId: string,event: InstagramMessagingEvent) 
{
  const senderExternalId = event.sender?.id;
  const recipientId = event.recipient?.id;
  const incomingMessage = event.message;
  if (!senderExternalId) {
    console.log('Skipping Instagram message without sender ID');
    return;
  }

  if (!incomingMessage) {
    return;
  }
 
  if (incomingMessage.is_echo) {
    console.log('Ignoring Instagram echo message',);
    return;
  }

  const externalMessageId = incomingMessage.mid;
  if (!externalMessageId) {
    console.log('Skipping Instagram message without MID',);
    return;
  }

  console.log('Processing inbound Instagram message',{
      instagramAccountId,
      senderExternalId,
      recipientId: recipientId ?? null,
      externalMessageId,
    },
  );
 
  const channelAccount = await resolveInstagramChannelAccount(instagramAccountId,recipientId);
  if (!channelAccount) {
    throw new Error(
      `Active Instagram ChannelAccount not found for Instagram account ${instagramAccountId}`,
    );
  }

  const organizationId = channelAccount.organizationId;
  const duplicate =
    await prisma
      .message
      .findFirst({
        where: {
          organizationId,
          externalMessageId,
        },
      });

  if (duplicate) {
    console.log(`Instagram message already exists: ${externalMessageId}`,);
    return duplicate;
  }

 

  const {contact} =
    await resolveInstagramContact(
      organizationId,
      senderExternalId,
      channelAccount.accessToken,
    );
 
  const {
    conversation,
    created: conversationCreated,
  } =
    await resolveInstagramConversation(
      organizationId,
      contact.id,
      channelAccount.id,
    );
 

  const type = resolveInstagramMessageType(incomingMessage);
  const body = resolveInstagramMessageBody(incomingMessage,);
  const mediaUrl = resolveInstagramMediaUrl(incomingMessage);
  let replyToMessageId: string | null = null;
  if (incomingMessage .reply_to ?.mid ) {
    const replyMessage =
      await prisma
        .message
        .findFirst({
          where: {
            organizationId,
            conversationId: conversation.id,
            externalMessageId: incomingMessage.reply_to.mid,
          },

          select: {
            id: true,
          },
        });
    replyToMessageId = replyMessage?.id ?? null;
  }
 

  const createdMessage =
    await prisma
      .$transaction(
        async transaction => {
          const dbMessage =
            await transaction
              .message
              .create({
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
                    channel: 'INSTAGRAM',
                    platform: 'INSTAGRAM',
                    instagramAccountId: channelAccount.instagramAccountId,
                    senderExternalId,
                    recipientExternalId: recipientId ?? null,
                    raw: toPrismaJson(event),
                  },
                },
              });

          await transaction
            .conversation
            .update({
              where: {
                id: conversation.id,
              },

              data: {
                lastMessageAt: dbMessage.createdAt,
              },
            });

          await transaction
            .conversationEvent
            .create({
              data: {
                organizationId,
                conversationId: conversation.id,
                actorUserId: null,
                type: 'MESSAGE_RECEIVED',
                metadata: {
                  provider: 'META',
                  channel: 'INSTAGRAM',
                  externalMessageId,
                  senderExternalId,
                },
              },
            });

          return dbMessage;
        },
      );

  console.log('INSTAGRAM MESSAGE CREATED',);
  console.log('Message ID:',createdMessage.id,);
  console.log('Conversation ID:',conversation.id,);
  console.log('Instagram sender:',senderExternalId,);

  if (conversationCreated) {
    emitToOrganization(
      organizationId,
      'conversation.created',
      conversation,
    );
  }

  emitToOrganization(
    organizationId,
    'message.created',
    createdMessage,
  );

  emitToConversation(
    conversation.id,
    'message.created',
    createdMessage,
  );

  emitToOrganization(
    organizationId,
    'conversation.updated',
    {
      ...conversation,
      lastMessageAt: createdMessage.createdAt,
    },
  );

  return createdMessage;
}

async function processInstagramDelivery(instagramAccountId: string,event: InstagramMessagingEvent,) {
  const mids = event.delivery?.mids ?? [];
  if (mids.length === 0) {
    return;
  }

  const channelAccount =
    await resolveInstagramChannelAccount(
      instagramAccountId,
      event.recipient?.id,
    );

  if (!channelAccount) {
    return;
  }

  for (const externalMessageId of mids ) {
    const existingMessage =
      await prisma
        .message
        .findFirst({
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
      await prisma
        .message
        .update({
          where: {
            id: existingMessage.id,
          },
          data: {
            status: 'DELIVERED',
            metadata: {
              provider: 'META',
              ...(typeof existingMessage.metadata === 'object' &&
                existingMessage.metadata !== null && !Array.isArray(existingMessage.metadata,) ? existingMessage.metadata : {}
              ),
              instagramDelivery: toPrismaJson(event.delivery,),
            },
          },
        });

    emitToOrganization(existingMessage.organizationId,'message.status.updated',updated,);
    emitToConversation(existingMessage.conversationId,'message.status.updated',updated,);
  }
}


async function processInstagramRead(instagramAccountId: string,event: InstagramMessagingEvent,) 
{
  const senderExternalId = event.sender?.id;
  const watermark = event.read?.watermark;

  if (!senderExternalId || !watermark) {
    return;
  }

  const channelAccount = await resolveInstagramChannelAccount(instagramAccountId,event.recipient?.id,);
  if (!channelAccount) {
    return;
  }

  const organizationId = channelAccount.organizationId;

  const identity =
    await prisma
      .contactIdentity
      .findUnique({
        where: {
          organizationId_channel_externalId: {
            organizationId,
            channel: 'INSTAGRAM',
            externalId: senderExternalId,
          },
        },
      });

  if (!identity) {
    return;
  }

  const conversation =
    await prisma
      .conversation
      .findFirst({
        where: {
          organizationId,
          contactId: identity.contactId,
          channel: 'INSTAGRAM',
          channelAccountId: channelAccount.id,
        },

        orderBy: {
          createdAt:'desc',
        },
      });

  if (!conversation) {
    return;
  }

  const readDate = new Date(watermark,);

  const messages =
    await prisma
      .message
      .findMany({
        where: {
          organizationId,
          conversationId: conversation.id,
          direction: 'OUTBOUND',

          status: {
            in: [
              'QUEUED',
              'SENT',
              'DELIVERED',
            ],
          },

          createdAt: {
            lte:
              readDate,
          },
        },
      });

  for (
    const message
    of messages
  ) {
    const updated =
      await prisma
        .message
        .update({
          where: {
            id:
              message.id,
          },

          data: {
            status: 'READ',

            metadata: {
              provider: 'META',
              ...(typeof message .metadata === 'object' && message.metadata !== null && !Array.isArray(message.metadata) ? message.metadata : {}),
              instagramRead: toPrismaJson(event.read),
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


/*
|--------------------------------------------------------------------------
| Postback
|--------------------------------------------------------------------------
*/

async function processInstagramPostback(instagramAccountId: string,event: InstagramMessagingEvent) 
{
  const senderExternalId = event.sender?.id;
  const postback = event.postback;
  if (!senderExternalId ||!postback) {
    return;
  }

  const channelAccount = await resolveInstagramChannelAccount(instagramAccountId,event.recipient?.id);
  if (!channelAccount) {
    throw new Error(
      `Active Instagram ChannelAccount not found for Instagram account ${instagramAccountId}`,
    );
  }

  const {contact} =
    await resolveInstagramContact(
      channelAccount.organizationId,
      senderExternalId,
      channelAccount.accessToken,
    );

  const {
    conversation,
    created: conversationCreated,
  } =
    await resolveInstagramConversation(
      channelAccount.organizationId,
      contact.id,
      channelAccount.id,
    );

  const externalMessageId = postback.mid ?? `instagram-postback:${instagramAccountId}:${senderExternalId}:${event.timestamp ?? Date.now()}`;

  const duplicate =
    await prisma
      .message
      .findFirst({
        where: {
          organizationId: channelAccount.organizationId,
          externalMessageId,
        },
      });

  if (duplicate) {
    return duplicate;
  }

  const body =
    postback.title ??
    postback.payload ??
    'Instagram postback';

  const createdMessage =
    await prisma
      .$transaction(
        async transaction => {
          const message =
            await transaction
              .message
              .create({
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
                    channel: 'INSTAGRAM',
                    platform: 'INSTAGRAM',
                    instagramAccountId,
                    senderExternalId,
                    postback: toPrismaJson(postback,),
                    raw: toPrismaJson(event,),
                  },
                },
              });

          await transaction
            .conversation
            .update({
              where: {
                id: conversation.id,
              },
              data: {
                lastMessageAt: message.createdAt,
              },
            });

          await transaction
            .conversationEvent
            .create({
              data: {
                organizationId: channelAccount.organizationId,
                conversationId: conversation.id,
                actorUserId: null,
                type: 'MESSAGE_RECEIVED',
                metadata: {
                  provider: 'META',
                  channel: 'INSTAGRAM',
                  event: 'POSTBACK',
                },
              },
            });

          return message;
        },
      );

  if (
    conversationCreated
  ) {
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
  return createdMessage;
}

 

async function processInstagramEvent(
  instagramAccountId: string,
  event: InstagramMessagingEvent,
) {
  if (event.message) {
    await processInstagramMessage(
      instagramAccountId,
      event,
    );

    return;
  }

  if (event.delivery) {
    await processInstagramDelivery(
      instagramAccountId,
      event,
    );

    return;
  }

  if (event.read) {
    await processInstagramRead(
      instagramAccountId,
      event,
    );

    return;
  }

  if (event.postback) {
    await processInstagramPostback(
      instagramAccountId,
      event,
    );

    return;
  }

  console.log('Ignoring unsupported Instagram event',{
      instagramAccountId,
      eventKeys: Object.keys(event),
    },
  );
}



export async function processInstagramWebhook(payload: InstagramWebhookPayload,): Promise<void> 
{
  console.log('\n========================================',);
  console.log('PROCESSING INSTAGRAM WEBHOOK',);
  console.log('Object:',payload.object ??'unknown',);
  const entries = Array.isArray(payload.entry,)? payload.entry: [];
  console.log(`Instagram webhook entries: ${entries.length}`,);

  for (const entry of entries ) {
    const instagramAccountId = entry.id;
    if (!instagramAccountId) {
      console.warn('Skipping Instagram entry without account ID',{entry},);
      continue;
    }
    const events = Array.isArray(entry.messaging,)? entry.messaging : [];
    console.log(`Instagram events for account ${instagramAccountId}: ${events.length}`,);
    for (const event of events ) {
      try {
        await processInstagramEvent(instagramAccountId,event,);
      } catch (error) {
        console.error('Instagram event processing failed',{
            instagramAccountId,
            senderId: event.sender?.id ?? null,
            recipientId: event.recipient?.id ?? null,
            error: getErrorMessage(error),
          },
        );
        throw error;
      }
    }
  }

  console.log('INSTAGRAM WEBHOOK PROCESSED',);
  console.log('========================================\n',);
}