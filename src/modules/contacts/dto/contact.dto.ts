export interface ContactIdentityDto {
    id: string;
    channel: string;
    externalId: string;
    username: string | null;
    phone: string | null;
    email: string | null;
    metadata: unknown;
    createdAt: Date;
    updatedAt: Date;
}

export interface ContactConversationDto {
    id: string;
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
}

export interface ContactDto {
    id: string;
    organizationId: string;
    displayName: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    email: string | null;
    company: string | null;
    bio: string | null;
    attributes: unknown;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    identities: ContactIdentityDto[];
    conversations?: ContactConversationDto[];
}

export interface ContactListResponseDto {
    contacts: ContactDto[];
    pagination: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
    };
}