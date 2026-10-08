import type {
    ConversationPriority,
    ConversationStatus,
} from '../../../../generated/prisma/client';

import type {
    ConversationRepository,
} from '../repositories/conversation.repository';

import type {
    ConversationQueryDto,
} from '../dto/conversation-query.dto';

import type {
    ConversationDto,
    ConversationListResponseDto,
} from '../dto/conversation.dto';

import {
    ConversationMapper,
} from '../mappers/conversation.mapper';


export class ConversationNotFoundError
extends Error {

    constructor() {

        super(
            'Conversation not found.',
        );

        this.name =
            'ConversationNotFoundError';
    }
}


export class ConversationService {

    constructor(
        private readonly conversationRepository:
            ConversationRepository,
    ) {}


    async list(
        organizationId: string,
        query: ConversationQueryDto,
    ): Promise<ConversationListResponseDto> {

        const result =
            await this.conversationRepository.findMany({
                organizationId,

                status:
                    query.status,

                channel:
                    query.channel,

                channelAccountId:
                    query.channelAccountId,

                assignedUserId:
                    query.assignedUserId,

                unassigned:
                    query.unassigned,

                search:
                    query.search,

                sort:
                    query.sort,

                page:
                    query.page,

                limit:
                    query.limit,
            });


        return {
            conversations:
                ConversationMapper.toCollection(
                    result.conversations,
                ),

            pagination: {
                page:
                    query.page,

                limit:
                    query.limit,

                total:
                    result.total,

                totalPages:
                    Math.max(
                        1,
                        Math.ceil(
                            result.total /
                            query.limit,
                        ),
                    ),
            },
        };
    }


    async getById(
        organizationId: string,
        conversationId: string,
    ): Promise<ConversationDto> {

        const conversation =
            await this.conversationRepository.findById(
                organizationId,
                conversationId,
            );


        if (!conversation) {
            throw new ConversationNotFoundError();
        }


        return ConversationMapper.toDto(
            conversation,
        );
    }


    async updateStatus(
        organizationId: string,
        conversationId: string,
        status: ConversationStatus,
    ): Promise<ConversationDto> {

        await this.ensureConversationExists(
            organizationId,
            conversationId,
        );


        const conversation =
            await this.conversationRepository.updateStatus(
                organizationId,
                conversationId,
                status,
            );


        if (!conversation) {
            throw new ConversationNotFoundError();
        }


        return ConversationMapper.toDto(
            conversation,
        );
    }


    async assign(
        organizationId: string,
        conversationId: string,
        assignedUserId: string | null,
    ): Promise<ConversationDto> {

        await this.ensureConversationExists(
            organizationId,
            conversationId,
        );


        const conversation =
            await this.conversationRepository.updateAssignment(
                organizationId,
                conversationId,
                assignedUserId,
            );


        if (!conversation) {
            throw new ConversationNotFoundError();
        }


        return ConversationMapper.toDto(
            conversation,
        );
    }


    async updatePriority(
        organizationId: string,
        conversationId: string,
        priority: ConversationPriority,
    ): Promise<ConversationDto> {

        await this.ensureConversationExists(
            organizationId,
            conversationId,
        );


        const conversation =
            await this.conversationRepository.updatePriority(
                organizationId,
                conversationId,
                priority,
            );


        if (!conversation) {
            throw new ConversationNotFoundError();
        }


        return ConversationMapper.toDto(
            conversation,
        );
    }


    private async ensureConversationExists(
        organizationId: string,
        conversationId: string,
    ): Promise<void> {

        const exists =
            await this.conversationRepository.exists(
                organizationId,
                conversationId,
            );


        if (!exists) {
            throw new ConversationNotFoundError();
        }
    }
}