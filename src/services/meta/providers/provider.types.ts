export type MetaChannel =
  | 'WHATSAPP'
  | 'FACEBOOK'
  | 'INSTAGRAM';


export type MetaChannelAccount = {
  id: string;
  organizationId: string;
  channel: MetaChannel;
  name: string;
  externalAccountId: string | null;
  phoneNumberId: string | null;
  pageId: string | null;
  instagramAccountId: string | null;
  accessToken: string;
};

export type SendTextInput = {
  account: MetaChannelAccount;
  recipientId: string;
  body: string;
  replyToExternalMessageId?: string;
};

export type SendMessageResult = {
  externalMessageId: string;
  raw: unknown;
};

export type EditTextInput = {
  account: MetaChannelAccount;
  externalMessageId: string;
  body: string;
};

export type EditMessageResult = {
  externalMessageId: string;
  raw: unknown;
};

export interface MetaProvider {
  sendText(input: SendTextInput,): Promise<SendMessageResult>;

  editText?(input: EditTextInput,): Promise<EditMessageResult>;
}