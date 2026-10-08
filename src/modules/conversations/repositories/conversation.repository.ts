import type {
    ConversationPriority,
    ConversationStatus,
} from '../../../../generated/prisma/client';
import type {ConversationListQuery} from '../types/conversation.types';

export interface ConversationRepository {
    
    findMany(query: ConversationListQuery): Promise<{
        conversations: unknown[];
        total: number;
    }>;

    findById(
        organizationId: string,
        conversationId: string,
    ): Promise<unknown | null>;

    updateStatus(
        organizationId: string,
        conversationId: string,
        status: ConversationStatus,
    ): Promise<unknown>;

    updateAssignment(
        organizationId: string,
        conversationId: string,
        assignedUserId: string | null,
    ): Promise<unknown>;

    updatePriority(
        organizationId: string,
        conversationId: string,
        priority: ConversationPriority,
    ): Promise<unknown>;

    exists(
        organizationId: string,
        conversationId: string,
    ): Promise<boolean>;
}