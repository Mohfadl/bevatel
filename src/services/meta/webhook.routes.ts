import 'dotenv/config';

import crypto from 'crypto';
import express, {Router,} from 'express';
import {prisma,} from '../../../shared/prisma';
import {metaWebhookQueue,} from './meta.queue';

const router = Router();

router.get('/', (request, response) => {
    console.log('\n========================================');
    console.log('META WEBHOOK GET RECEIVED');
    console.log('URL:', request.originalUrl);
    console.log('QUERY:', request.query);
    const mode = String(request.query['hub.mode'] ?? '');
    const verifyToken = String(request.query['hub.verify_token'] ?? '');
    const challenge = String(request.query['hub.challenge'] ?? '');
    const expectedToken = process.env.META_VERIFY_TOKEN ?? '';
    console.log('mode:', mode);
    console.log('challenge:', challenge);

    if (mode === 'subscribe' && verifyToken === expectedToken ) {
      console.log('META WEBHOOK VERIFICATION SUCCESS');
      console.log('========================================\n');
      return response.status(200).send(challenge);
    }
    console.warn('META WEBHOOK VERIFICATION FAILED');
    console.log('========================================\n');
    return response.status(403).send('Forbidden');
  },
);

type SignatureSecret = {name: string; value: string;};

function getSignatureSecrets(): SignatureSecret[] {
  const secrets: SignatureSecret[] = [];
  const metaAppSecret = process.env.META_APP_SECRET?.trim();
  const instagramAppSecret = process.env.INSTAGRAM_APP_SECRET?.trim();
  if (metaAppSecret) {
    secrets.push({
      name: 'META_APP_SECRET',
      value: metaAppSecret,
    });
  }

  if (instagramAppSecret && instagramAppSecret !== metaAppSecret ) {
    secrets.push({
      name: 'INSTAGRAM_APP_SECRET',
      value: instagramAppSecret,
    });
  }
  return secrets;
}


function signatureMatches(
  rawBody: Buffer,
  signature: string,
  secret: string,
): boolean {
  const expectedSignature = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  const receivedBuffer = Buffer.from(signature,'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8',);

  if (receivedBuffer.length !== expectedBuffer.length ) {
    return false;
  }
  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}


function verifySignature(
  rawBody: Buffer,
  signature: string | undefined,
): boolean {
  if (process.env.META_VERIFY_SIGNATURE !== 'true') {
    console.warn('Meta webhook signature verification is disabled');
    return true;
  }

  if (!signature) {
    console.error('x-hub-signature-256 header is missing');
    return false;
  }

  if (!signature.startsWith('sha256=')) {
    console.error('Invalid x-hub-signature-256 format');
    return false;
  }

  const secrets = getSignatureSecrets();
  if (secrets.length === 0) {
    console.error('No Meta webhook signature secrets are configured');
    return false;
  }

  for (const secret of secrets) {
    if (signatureMatches(rawBody,signature,secret.value)) {
      console.log(`Meta signature matched using ${secret.name}`);
      return true;
    }
  }

  console.error('Signature did not match any configured Meta app secret');
  return false;
}


router.post('/',
  express.raw({
    type: 'application/json',
    limit: '5mb',
  }),

  async (request, response) => {
    console.log('\n========================================');
    console.log('META WEBHOOK POST RECEIVED');
    try {
      const rawBody = request.body as Buffer;
      if (!Buffer.isBuffer(rawBody)) {
        console.error('Webhook body is not a Buffer');

        return response
          .status(400)
          .json({
            success: false,
            message: 'Invalid webhook body',
          });
      }

      console.log('Raw body bytes:',rawBody.length,);
      const signatureHeader = request.headers['x-hub-signature-256'];
      const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
      console.log('Checking Meta signature...');
      if (!verifySignature(rawBody,signature)) {
        console.warn('Invalid Meta webhook signature');
        console.log('========================================\n');
        return response
          .status(401)
          .json({
            success: false,
            message: 'Invalid signature',
          });
      }
      console.log('Signature accepted');
      let payload: any;
      try {
        payload = JSON.parse(rawBody.toString('utf8'));
      } catch (error) {
        console.error('Invalid webhook JSON:', error,);
        return response
          .status(400)
          .json({
            success: false,
            message: 'Invalid JSON',
          });
      }
      console.log('Payload parsed');
      console.log('Webhook object:',payload?.object,);
      const externalEventId = extractExternalEventId(payload,);
      console.log('External event ID:',externalEventId ??'not-found',);
      console.log('1. Saving WebhookReceipt to MySQL...');
      const receipt =
        await prisma
          .webhookReceipt
          .create({
            data: {
              source: 'META',
              externalEventId,
              payload: payload as any,
            },
          });
      console.log('2. WebhookReceipt saved:',receipt.id,);
      console.log('3. Adding webhook to BullMQ...');
      await metaWebhookQueue.add('process-meta-webhook',{receiptId: receipt.id},
        {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 1000,
          },
          removeOnComplete: {
            count: 100,
          },
          removeOnFail: {
            count: 500,
          },
        },
      );

      console.log('4. BullMQ job created successfully');
      console.log('META WEBHOOK ACCEPTED');
      console.log('========================================\n');
      return response
        .status(200)
        .json({
          success: true,
        });
    } catch (error) {
      console.error('META WEBHOOK ERROR:',error,);
      console.log('========================================\n');
      return response
        .status(500)
        .json({
          success: false,
          message: 'Webhook processing failed',
        });
    }
  },
);

function extractExternalEventId(payload: any,): string | undefined 
{
  try {
    const value = payload?.entry?.[0]?.changes?.[0]?.value;
    const whatsappMessageId = value?.messages?.[0]?.id;
    if (whatsappMessageId) {
      return whatsappMessageId;
    }
    const whatsappStatus = value?.statuses?.[0];
    if (whatsappStatus?.id) {
      return (`${whatsappStatus.id}:` +`${whatsappStatus.status}`);
    }
    const messaging = payload?.entry?.[0]?.messaging?.[0];
    if (messaging?.message?.mid) {
      return messaging.message.mid;
    }
    return undefined;
  } catch (error) {
    console.error('Failed to extract external event ID:',error,);
    return undefined;
  }
}

export default router;