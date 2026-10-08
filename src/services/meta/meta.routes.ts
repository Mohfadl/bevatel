import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../../../shared/prisma';

import {
  authMiddleware,
  type AuthRequest,
} from '../../../shared/auth';

import {
  getMetaProvider,
} from './providers/provider.factory';

import {
  emitToConversation,
  emitToOrganization,
} from '../../realtime/socket';

import {
  ensureConversationChannelAccount,
} from '../conversations/channel-account.service';


const router = Router();
const metaChannelEnum =z.enum(['WHATSAPP','FACEBOOK','INSTAGRAM']);

router.get('/health',
  (_request,response,) => {
    return response.json({
      success: true,
      service: 'meta',
      graphVersion: process.env.META_GRAPH_VERSION ?? 'v26.0',
    });
  },
);

router.get('/accounts',
  authMiddleware,
  async (
    request: AuthRequest,
    response,
  ) => {
    try {
      if (!request.user) {
        return response
          .status(401)
          .json({
            success: false,
            message: 'Unauthorized',
          });
      }

      const accounts =
        await prisma
          .channelAccount
          .findMany({
            where: {
              organizationId: request.user.organizationId,
              channel: {
                in: ['WHATSAPP','FACEBOOK','INSTAGRAM',],
              },
            },

            select: {
              id: true,
              channel: true,
              name: true,
              externalAccountId: true,
              phoneNumberId: true,
              pageId: true,
              instagramAccountId: true,
              status: true,
              metadata: true,
              createdAt: true,
              updatedAt: true,
            },
 
            orderBy: {
              createdAt: 'desc',
            },
          });

      return response
        .status(200)
        .json({
          success: true,
          data: accounts,
        });
    } catch (error) {
      console.error('List Meta accounts error:',error,);
      return response
        .status(500)
        .json({
          success: false,
          message: error instanceof Error ? error.message : 'Failed to load Meta accounts',
        });
    }
  },
);

router.post(
  '/accounts',
  authMiddleware,
  async (
    request: AuthRequest,
    response,
  ) => {
    try {
      if (!request.user) {
        return response
          .status(401)
          .json({
            success: false,
            message: 'Unauthorized',
          });
      }

      const schema =
        z.object({
          channel: metaChannelEnum,
          name: z.string().trim().min(2),
          externalAccountId: z.string().optional(),
          phoneNumberId: z.string().optional(),
          pageId: z.string().optional(),
          instagramAccountId: z.string().optional(),
          accessToken: z.string().min(10),
          metadata: z.record(z.string(),z.any(),).optional(),
        });

      const parsed = schema.safeParse(request.body,);
      if (!parsed.success) {
        return response
          .status(422)
          .json({
            success: false,
            errors: parsed.error.flatten(),
          });
      }

      if (parsed.data.channel === 'WHATSAPP' && !parsed.data.phoneNumberId) {
        return response
          .status(422)
          .json({
            success: false,
            message: 'phoneNumberId is required for WhatsApp',
          });
      }

      if (parsed.data.channel === 'FACEBOOK' && !parsed.data.pageId) {
        return response
          .status(422)
          .json({
            success: false,
            message: 'pageId is required for Facebook',
          });
      }

      if (parsed.data.channel === 'INSTAGRAM' && !parsed.data.instagramAccountId) {
        return response
          .status(422)
          .json({
            success: false,
            message: 'instagramAccountId is required for Instagram',
          });
      }

      const account =
        await prisma
          .channelAccount
          .create({
            data: {
              organizationId: request.user.organizationId,
              channel: parsed.data.channel,
              name: parsed.data.name,
              externalAccountId: parsed.data.externalAccountId,
              phoneNumberId: parsed.data.phoneNumberId,
              pageId: parsed.data.pageId,
              instagramAccountId: parsed.data.instagramAccountId,
              accessToken: parsed.data.accessToken,
              metadata: parsed.data.metadata,
              status: 'ACTIVE',
            },
          });

      return response
        .status(201)
        .json({
          success: true,
          data: {
            id: account.id,
            channel: account.channel,
            name: account.name,
            externalAccountId: account.externalAccountId,
            phoneNumberId: account.phoneNumberId,
            pageId: account.pageId,
            instagramAccountId: account.instagramAccountId,
            status: account.status,
            metadata: account.metadata,
            createdAt: account.createdAt,
            updatedAt: account.updatedAt,
          },
        });
    } catch (error) {
      console.error('Create Meta account error:',error,);
      return response
        .status(500)
        .json({
          success: false,
          message: error instanceof Error ? error.message : 'Failed to create account',
        });
    }
  },
);

router.get(
  '/messages/:messageId/media',
  authMiddleware,
  async (
    request: AuthRequest,
    response,
  ) => {
    try {
      if (!request.user) {
        return response
          .status(401)
          .json({
            success: false,
            message: 'Unauthorized',
          });
      }

      const organizationId = request.user.organizationId;
      const messageId = String(request.params.messageId);

      const message =
        await prisma
          .message
          .findFirst({
            where: {
              id: messageId,
              organizationId,
            },
            select: {
              id: true,
              type: true,
              mimeType: true,
              mediaUrl: true,
              metadata: true,
              conversation: {
                select: {
                  id: true,
                  organizationId: true,
                  channel: true,
                  channelAccount: {
                    select: {
                      id: true,
                      organizationId: true,
                      channel: true,
                      accessToken: true,
                      status: true,
                    },
                  },
                },
              },
            },
          });

      if (!message) {
        return response
          .status(404)
          .json({
            success: false,
            message: 'Message not found',
          });
      }

      const mediaTypes = new Set([
        'IMAGE',
        'VIDEO',
        'AUDIO',
        'DOCUMENT',
        'STICKER',
      ]);

      if (!mediaTypes.has(message.type)) {
        return response
          .status(422)
          .json({
            success: false,
            message: 'This message does not contain downloadable media',
          });
      }

      const channelAccount = message.conversation.channelAccount;
      if (!channelAccount) {
        return response
          .status(422)
          .json({
            success: false,
            message: 'Conversation has no channel account',
          });
      }

      if (channelAccount.organizationId !== organizationId) {
        return response
          .status(403)
          .json({
            success: false,
            message: 'Forbidden',
          });
      }

      if (channelAccount.status !== 'ACTIVE') {
        return response
          .status(422)
          .json({
            success: false,
            message: 'Channel account is disabled',
          });
      }

      const metadata =
        message.metadata &&
        typeof message.metadata === 'object' &&
        !Array.isArray(message.metadata)
          ? message.metadata as Record<string, unknown>
          : {};

      let mediaBuffer: Buffer;
      let contentType: string;
      let filename = `${message.type.toLowerCase()}-${message.id}`;
 
      if (message.conversation.channel === 'WHATSAPP') {
        const rawMediaId = metadata.mediaId;
        const mediaId = typeof rawMediaId === 'string' ? rawMediaId.trim() : '';
        if (!mediaId) {
          return response
            .status(404)
            .json({
              success: false,
              message: 'Meta media ID was not stored for this message',
            });
        }

        const graphVersion = process.env.META_GRAPH_VERSION ?? 'v26.0';
        const mediaInfoResponse =
          await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(mediaId)}`,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${channelAccount.accessToken}`,
              },
              signal: AbortSignal.timeout(15000),
            },
          );

        const mediaInfo =
          await mediaInfoResponse.json() as {
            url?: string;
            mime_type?: string;
            file_size?: number;
            id?: string;
            error?: {
              message?: string;
              type?: string;
              code?: number;
            };
          };

        if (!mediaInfoResponse.ok || !mediaInfo.url) {
          console.error('Meta WhatsApp media metadata request failed:',
            {
              messageId: message.id,
              status: mediaInfoResponse.status,
              error: mediaInfo.error?.message ?? 'Unknown Meta media error',
            },
          );

          return response
            .status(mediaInfoResponse.status === 404 ? 404 : 502)
            .json({
              success: false,
              message: mediaInfo.error?.message ?? 'Unable to retrieve media information from Meta',
            });
        }

        const mediaResponse =
          await fetch(
            mediaInfo.url,
            {
              method: 'GET',
              headers: {
                Authorization: `Bearer ${channelAccount.accessToken}`,
              },
              signal: AbortSignal.timeout(30000),
            },
          );

        if (!mediaResponse.ok) {
          console.error('Meta WhatsApp media download failed:',
            {
              messageId: message.id,
              status: mediaResponse.status,
            },
          );

          return response
            .status(502)
            .json({
              success: false,
              message: 'Unable to download media from Meta',
            });
        }

        mediaBuffer = Buffer.from(await mediaResponse.arrayBuffer());
        contentType = mediaResponse.headers.get('content-type') ?? mediaInfo.mime_type ?? message.mimeType ?? 'application/octet-stream';
        const rawMetadata = metadata.raw && typeof metadata.raw === 'object' && !Array.isArray(metadata.raw) ? metadata.raw as Record<string, unknown> : {};
        const rawDocument = rawMetadata.document && typeof rawMetadata.document === 'object' && !Array.isArray(rawMetadata.document) ? rawMetadata.document as Record<string, unknown> : {};
        const documentFilename = typeof rawDocument.filename === 'string' ? rawDocument.filename : '';
        if (documentFilename) {
          filename = documentFilename;
        }
      }
 
      else if (message.conversation.channel === 'FACEBOOK') {
        const messengerMediaUrl = typeof message.mediaUrl === 'string' ? message.mediaUrl.trim() : '';
        if (!messengerMediaUrl) {
          return response
            .status(404)
            .json({
              success: false,
              message: 'Facebook Messenger media URL was not stored for this message',
            });
        }

        let parsedMediaUrl: URL;
        try {
          parsedMediaUrl = new URL(messengerMediaUrl);
        } catch {
          return response
            .status(422)
            .json({
              success: false,
              message: 'Stored Facebook Messenger media URL is invalid',
            });
        }

        if (parsedMediaUrl.protocol !== 'https:') {
          return response
            .status(422)
            .json({
              success: false,
              message: 'Facebook Messenger media URL must use HTTPS',
            });
        }
 
        const mediaResponse =
          await fetch(
            parsedMediaUrl.toString(),
            {
              method: 'GET',
              redirect: 'follow',
              signal: AbortSignal.timeout(30000),
            },
          );

        if (!mediaResponse.ok) {
          console.error('Facebook Messenger media download failed:',
            {
              messageId: message.id,
              status: mediaResponse.status,
              host: parsedMediaUrl.hostname,
            },
          );

          return response
            .status(mediaResponse.status === 404 ? 404 : 502)
            .json({
              success: false,
              message: 'Unable to download Facebook Messenger media',
            });
        }

        mediaBuffer = Buffer.from(await mediaResponse.arrayBuffer());
        contentType = mediaResponse.headers.get('content-type') ?? message.mimeType ?? 'application/octet-stream';
        const raw = metadata.raw && typeof metadata.raw === 'object' && !Array.isArray(metadata.raw) ? metadata.raw as Record<string, unknown> : {};
        const attachment = raw.attachment && typeof raw.attachment === 'object' && !Array.isArray(raw.attachment) ? raw.attachment as Record<string, unknown> : {};
        const attachmentName = typeof attachment.name === 'string' ? attachment.name.trim() : '';
        if (attachmentName) {
          filename = attachmentName;
        }
      }

      else if (message.conversation.channel === 'INSTAGRAM') {
        return response
          .status(422)
          .json({
            success: false,
            message: 'Media proxy does not support Instagram messages yet',
          });
      }

      else {
        return response
          .status(422)
          .json({
            success: false,
            message: `Unsupported media channel: ${message.conversation.channel}`,
          });
      }

      const safeFilename = filename.replace(/[\r\n"]/g, '').replace(/[\\/]/g, '_');
      response.setHeader('Content-Type',contentType);
      response.setHeader('Content-Length',String(mediaBuffer.length));
      response.setHeader('Content-Disposition',`${message.type === 'DOCUMENT'? 'attachment': 'inline'}; filename="${safeFilename}"`);
      response.setHeader('Cache-Control','private, max-age=300');
      response.setHeader('X-Content-Type-Options','nosniff');
      return response
        .status(200)
        .send(mediaBuffer);
    } catch (error) {
      console.error('Get Meta media error:',error);
      if (error instanceof Error && (error.name === 'TimeoutError' ||  error.name === 'AbortError')) {
        return response
          .status(504)
          .json({
            success: false,
            message: 'Meta media request timed out',
          });
      }
      return response
        .status(500)
        .json({
          success: false,
          message: error instanceof Error ? error.message : 'Unable to load media',
        });
    }
  },
);

router.post('/conversations/:conversationId/messages',
  authMiddleware,
  async (request: AuthRequest, response) => {
    try { 
      if (!request.user) {
        return response
          .status(401)
          .json({
            success: false,
            message: 'Unauthorized',
          });
      }
 
      const schema =
        z.object({
          type: z.literal('TEXT',).default('TEXT',),
          body: z.string().trim().min(1),
          replyToMessageId: z.string().uuid().optional(),
          purpose: z.enum(['NORMAL','FOLLOW_UP']).default('NORMAL'),
        });

      const parsed = schema.safeParse(request.body,);
      if (!parsed.success) {
        return response
          .status(422)
          .json({
            success: false,
            errors: parsed.error.flatten(),
          });
      }

      const organizationId = request.user.organizationId;
      const conversationId = String(request.params.conversationId,);
      const conversationExists =
        await prisma
          .conversation
          .findFirst({
            where: {
              id: conversationId,
              organizationId,
              channel: {
                in: ['WHATSAPP','FACEBOOK','INSTAGRAM',],
              },
            },
            select: {
              id: true,
              organizationId: true,
              channel: true,
            },
          });

      if (!conversationExists) {
        return response
          .status(404)
          .json({
            success: false,
            message: 'Conversation not found',
          });
      }
      let conversation;
      try {
        conversation = await ensureConversationChannelAccount(conversationId);
      } catch (error) {
        console.error('Ensure conversation channel account error:',error,);
        return response
          .status(422)
          .json({
            success: false,
            message: error instanceof Error
                ? error.message
                : 'Unable to resolve channel account',
          });
      }

      if (conversation.organizationId !==organizationId) {
        return response
          .status(403)
          .json({
            success: false,
            message: 'Forbidden',
          });
      }

      if (!conversation.channelAccount) {
        return response
          .status(422)
          .json({
            success: false,
            message: 'Unable to resolve channel account',
          });
      }

      if (conversation.channelAccount.status !== 'ACTIVE') {
        return response
          .status(422)
          .json({
            success: false,
            message: 'Channel account is disabled',
          });
      }

      const identity = conversation.contact.identities.find(item => item.channel === conversation.channel);
      if (!identity) {
        return response
          .status(422)
          .json({
            success: false,
            message: `Contact has no ${conversation.channel} identity`,
          });
      }

      let replyExternalId: string | undefined;
      if (parsed.data.replyToMessageId) {
        const replyMessage =
          await prisma
            .message
            .findFirst({
              where: {
                id: parsed.data.replyToMessageId,
                organizationId,
                conversationId:conversation.id,
              },
              select: {
                externalMessageId: true,
              },
            });

        if (!replyMessage) {
          return response
            .status(404)
            .json({
              success: false,
              message: 'Reply message not found',
            });
        }
        replyExternalId = replyMessage.externalMessageId ??undefined;
      }
 
      const queuedMessage =
        await prisma
          .message
          .create({
            data: {
              organizationId,
              conversationId: conversation.id,
              contactId: conversation.contactId,
              senderUserId: request.user.id,
              direction: 'OUTBOUND',
              type: 'TEXT',
              purpose: parsed.data.purpose,
              body: parsed.data.body,
              replyToMessageId: parsed.data.replyToMessageId,
              status: 'QUEUED',
              metadata: {
                provider: 'META',
                channel: conversation.channel,
              },
            },
          });

      emitToOrganization(organizationId,'message.created',queuedMessage);
      emitToConversation(conversation.id,'message.created',queuedMessage);
 
      try {
        const provider = getMetaProvider(conversation.channel as| 'WHATSAPP'| 'FACEBOOK'| 'INSTAGRAM');
        const result =
          await provider.sendText({
            account: {
              id: conversation.channelAccount.id,
              organizationId: conversation.channelAccount.organizationId,
              channel: conversation.channelAccount.channel as| 'WHATSAPP'| 'FACEBOOK'| 'INSTAGRAM',
              name: conversation.channelAccount.name,
              externalAccountId: conversation.channelAccount.externalAccountId,
              phoneNumberId: conversation.channelAccount.phoneNumberId,
              pageId: conversation.channelAccount.pageId,
              instagramAccountId: conversation.channelAccount.instagramAccountId,
              accessToken: conversation.channelAccount.accessToken,
            },
            recipientId: identity.externalId,
            body: parsed.data.body,
            replyToExternalMessageId: replyExternalId,
          });

        const sentMessage =
          await prisma
            .$transaction(
              async transaction => {
                const updated =
                  await transaction
                    .message
                    .update({
                      where: {
                        id: queuedMessage.id,
                      },
                      data: {
                        status: 'SENT',
                        externalMessageId: result.externalMessageId,
                        metadata: {
                          provider: 'META',
                          channel: conversation.channel,
                          purpose: parsed.data.purpose,
                          response: result.raw as any,
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
                      lastMessageAt: updated.createdAt,
                    },
                  });
                await transaction
                  .conversationEvent
                  .create({
                    data: {
                      organizationId,
                      conversationId: conversation.id,
                      actorUserId: request.user!.id,
                      type: 'MESSAGE_SENT',
                    },
                  });
                return updated;
              },
            );

        emitToOrganization(organizationId,'message.status.updated',sentMessage);
        emitToConversation(conversation.id,'message.status.updated',sentMessage,);
        return response
          .status(201)
          .json({
            success: true,
            data: sentMessage,
          });
      } catch (providerError) {
        const failed =
          await prisma
            .message
            .update({
              where: {
                id: queuedMessage.id,
              },
              data: {
                status: 'FAILED',
                metadata: {
                  provider: 'META',
                  channel: conversation.channel,
                  error: providerError instanceof Error ? providerError .message : String(providerError),
                },
              },
            });
        emitToOrganization(organizationId,'message.status.updated',failed);
        emitToConversation(conversation.id,'message.status.updated',failed);
        throw providerError;
      }
    } catch (error) {
      console.error('Send Meta message error:',error,);
      return response
        .status(500)
        .json({
          success: false,
          message: error instanceof Error ? error.message: 'Message send failed',
        });
    }
  },
);


router.patch('/messages/:messageId',authMiddleware,
  async (request: AuthRequest,response) => {
    try {
      if (!request.user) {
        return response
          .status(401)
          .json({
            success: false,
            message: 'Unauthorized',
          });
      }
 
      const schema = z.object({
        body: z.string().trim().min(1,'Message cannot be empty',).max(4096,'Message is too long',),
      });

      const parsed = schema.safeParse(request.body,);
      if (!parsed.success) {
        return response
          .status(422)
          .json({
            success: false,
            message: 'Invalid message data',
            errors: parsed.error.flatten(),
          });
      }

      const organizationId = request.user.organizationId;
      const messageId = String(request.params.messageId,);
      const newBody = parsed.data.body;
      const message =
        await prisma.message.findFirst({
          where: {id: messageId, organizationId,},
          select: {
            id: true,
            organizationId: true,
            conversationId: true,
            contactId: true,
            senderUserId: true,
            direction: true,
            type: true,
            purpose: true,
            body: true,
            status: true,
            externalMessageId: true,
            metadata: true,
            createdAt: true,
            updatedAt: true,
            conversation: {
              select: {
                id: true,
                organizationId: true,
                channel: true,
                channelAccountId: true,
                channelAccount: {
                  select: {
                    id: true,
                    organizationId: true,
                    channel: true,
                    status: true,
                  },
                },
              },
            },
          },
        });

      if (!message) {
        return response
          .status(404)
          .json({
            success: false,
            message: 'Message not found',
          });
      }
 
      if (message.organizationId !==organizationId || message.conversation.organizationId !== organizationId) {
        return response
          .status(403)
          .json({
            success: false,
            message: 'Forbidden',
          });
      }

      if (message.direction !== 'OUTBOUND' ) {
        return response
          .status(422)
          .json({
            success: false,
            message: 'Only outbound messages can be edited',
          });
      }

      if (message.type !== 'TEXT') {
        return response
          .status(422)
          .json({
            success: false,
            message: 'Only text messages can be edited',
          });
      }

      const currentBody = message.body?.trim() ?? '';
      if (currentBody === newBody) {
        return response
          .status(200)
          .json({
            success: true,
            message: 'No changes were made',
            data: message,
          });
      }

      if (message.externalMessageId) {
        return response
          .status(409)
          .json({
            success: false,
            message: 'This message has already been sent to the customer and cannot be edited until provider-side editing is supported.',
            data: {
              messageId:
                message.id,
              channel: message.conversation.channel,
              status: message.status,
              externalMessageId: message.externalMessageId,
            },
          });
      }

      if (['SENT','DELIVERED','READ'].includes(message.status)) {
        return response
          .status(409)
          .json({
            success: false,
            message: 'This message has already been sent to the customer and cannot be edited locally.',
          });
      }

      if (!['QUEUED','FAILED'].includes(message.status)) {
        return response
          .status(422)
          .json({
            success: false,
            message: `Message with status ${message.status} cannot be edited`,
          });
      }

      const currentMetadata = message.metadata && typeof message.metadata === 'object' && !Array.isArray(message.metadata,) ? message.metadata as Record<string,unknown> : {};
      const updatedMessage =
        await prisma.message.update({
          where: {
            id: message.id,
          },
          data: {
            body: newBody,
            metadata: {
              ...currentMetadata,
              edited: true,
              editedAt: new Date().toISOString(),
              editedByUserId: request.user.id,
              previousBody: message.body,
            },
          },
        });

      emitToOrganization(organizationId,'message.updated',updatedMessage);
      emitToConversation(message.conversationId,'message.updated',updatedMessage);
      return response
        .status(200)
        .json({
          success: true,
          message: 'Message updated successfully',
          data: updatedMessage,
        });
    } catch (error) {
      console.error('Edit Meta message error:',error,);
      return response
        .status(500)
        .json({
          success: false,
          message: error instanceof Error ? error.message : 'Message update failed',
        });
    }
  },
);



export default router;
