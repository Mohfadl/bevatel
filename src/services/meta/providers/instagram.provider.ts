import 'dotenv/config';

import type {
  MetaProvider,
  SendMessageResult,
  SendTextInput,
} from './provider.types';

type InstagramResponse = {
  recipient_id?: string;
  message_id?: string;

  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

class InstagramProvider implements MetaProvider
{
  async sendText(input: SendTextInput,): Promise<SendMessageResult> {
    const graphVersion = process.env.META_GRAPH_VERSION ?? 'v26.0';
    const instagramAccountId = input.account.instagramAccountId?.trim();
    if (!instagramAccountId) {
      throw new Error('Instagram account id is missing',);
    }

    const accessToken = input.account.accessToken?.trim();
    if (!accessToken) {
      throw new Error('Instagram access token is missing',);
    }

    const recipientId = input.recipientId?.trim();
    if (!recipientId) {
      throw new Error('Instagram recipient id is missing',);
    }

    const body = input.body?.trim();
    if (!body) {
      throw new Error('Instagram message body is empty');
    }

    const url = `https://graph.instagram.com/${graphVersion}/${encodeURIComponent(instagramAccountId)}/messages`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(),15000,);
    try {
      const response =
        await fetch(url,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },

            body: JSON.stringify({
              recipient: {
                id: recipientId,
              },

              message: {
                text: body,
              },
            }),

            signal: controller.signal,
          },
        );

      const result = await response.json() as InstagramResponse;
      if (!response.ok) {
        console.error('Instagram API error:',{
            status: response.status,
            code: result.error?.code,
            errorSubcode: result.error?.error_subcode,
            type: result.error?.type,
            message: result.error?.message,
            fbtraceId: result.error?.fbtrace_id,
          },
        );
        throw new Error(result.error?.message ?? `Instagram API request failed with status ${response.status}`,);
      }

      if (!result.message_id) {
        console.error('Instagram API returned no message_id:',{
            status: response.status,
            recipientId: result.recipient_id,
          },
        );
        throw new Error('Instagram did not return message_id',);
      }

      return {
        externalMessageId: result.message_id,
        raw: result,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Instagram API request timed out',);
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const instagramProvider = new InstagramProvider();