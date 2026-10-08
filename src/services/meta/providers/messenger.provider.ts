import 'dotenv/config';

import type {
  MetaProvider,
  SendMessageResult,
  SendTextInput,
} from './provider.types';


type MessengerResponse = {
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


class MessengerProvider
  implements MetaProvider
{
  async sendText(
    input: SendTextInput,
  ): Promise<SendMessageResult> {
    const graphVersion = process.env.META_GRAPH_VERSION ?? 'v26.0';
    const pageId = input.account.pageId;
    if (!pageId) {
      throw new Error(
        'Facebook pageId is missing',
      );
    }

    if (!input.account.accessToken) {
      throw new Error('Facebook Page access token is missing',);
    }

    if (!input.recipientId) {
      throw new Error('Messenger recipient PSID is missing',);
    }

    const url = `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(pageId)}/messages`;
    const response =
      await fetch(
        url,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${input.account.accessToken}`,
            'Content-Type': 'application/json',
          },

          body:
            JSON.stringify({
              recipient: {
                id:
                  input.recipientId,
              },

              messaging_type:
                'RESPONSE',

              message: {
                text:
                  input.body,
              },
            }),

          signal:
            AbortSignal.timeout(
              15000,
            ),
        },
      );

    const result =
      await response.json() as MessengerResponse;

    if (!response.ok) {
      console.error(
        'Messenger API error:',
        {
          status:
            response.status,

          code:
            result.error?.code,

          subcode:
            result.error
              ?.error_subcode,

          type:
            result.error?.type,

          message:
            result.error?.message,

          traceId:
            result.error
              ?.fbtrace_id,
        },
      );

      throw new Error(
        result.error?.message ??
        'Messenger API request failed',
      );
    }

    if (
      !result.message_id
    ) {
      throw new Error(
        'Messenger did not return message_id',
      );
    }

    return {
      externalMessageId:
        result.message_id,

      raw:
        result,
    };
  }
}


export const messengerProvider =
  new MessengerProvider();