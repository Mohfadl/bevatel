import type {
    ChannelType,
    ConversationPriority,
    ConversationStatus,
} from '../../../../generated/prisma/client';


export type ConversationSort = |'newest'|'oldest';

export interface ConversationListQuery {
    organizationId: string;
    status?: ConversationStatus;
    channel?: ChannelType;
    channelAccountId?: string;
    assignedUserId?: string;
    unassigned?: boolean;
    search?: string;
    sort?: ConversationSort;
    page: number;
    limit: number;
}

export interface ConversationPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface ConversationListResult {
    conversations: unknown[];
    pagination: ConversationPagination;
}

export interface UpdateConversationStatusInput {
    organizationId: string;
    conversationId: string;
    status: ConversationStatus;
    actorUserId?: string | null;
}

export interface AssignConversationInput {
    organizationId: string;
    conversationId: string;
    assignedUserId: string | null;
    actorUserId?: string | null;
}

export interface UpdateConversationPriorityInput {
    organizationId: string;
    conversationId: string;
    priority: ConversationPriority;
    actorUserId?: string | null;
}