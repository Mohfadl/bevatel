import type {
    ChannelType,
    ConversationStatus,
} from '../../../../generated/prisma/client';

import type {ConversationSort} from '../types/conversation.types';

export interface ConversationQueryDto {
    status?: ConversationStatus;
    channel?: ChannelType;
    channelAccountId?: string;
    assignedUserId?: string;
    unassigned?: boolean;
    search?: string;
    sort: ConversationSort;
    page: number;
    limit: number;
}