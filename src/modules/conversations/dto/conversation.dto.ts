export interface ConversationContactDto {
    id: string;
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    email: string | null;
    company: string | null;
    status: string;
}

export interface ConversationChannelAccountDto {
    id: string;
    channel: string;
    name: string;
    externalAccountId: string | null;
    phoneNumberId: string | null;
    pageId: string | null;
    instagramAccountId: string | null;
}

export interface ConversationAssignedUserDto {
    id: string;
    name: string;
    email: string;
}

export interface ConversationMessageDto {
    id: string;
    conversationId: string;
    contactId: string;
    senderUserId: string | null;
    direction: string;
    type: string;
    body: string | null;
    mediaUrl: string | null;
    mimeType: string | null;
    externalMessageId: string | null;
    replyToMessageId: string | null;
    status: string;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
}

export interface ConversationLabelDto {
    id: string;
    name: string;
}

export interface ConversationDto {
    id: string;
    organizationId: string;
    contactId: string;
    channelAccountId: string | null;
    assignedUserId: string | null;
    channel: string;
    status: string;
    priority: string;
    subject: string | null;
    openedAt: Date;
    lastMessageAt: Date | null;
    resolvedAt: Date | null;
    closedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    contact: ConversationContactDto | null;
    channelAccount: ConversationChannelAccountDto | null;
    assignedUser: ConversationAssignedUserDto | null;
    messages: ConversationMessageDto[];
    labels: ConversationLabelDto[];
}

export interface ConversationListResponseDto {
    conversations: ConversationDto[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}