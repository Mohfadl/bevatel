import type {
    ConversationDto,
    ConversationLabelDto,
    ConversationMessageDto,
} from '../dto/conversation.dto';


export class ConversationMapper {

    static toDto(
        conversation: any,
    ): ConversationDto {

        return {
            id: conversation.id,
            organizationId: conversation.organizationId,
            contactId: conversation.contactId,
            channelAccountId: conversation.channelAccountId ?? null,
            assignedUserId: conversation.assignedUserId ?? null,
            channel: conversation.channel,
            status: conversation.status,
            priority: conversation.priority,
            subject: conversation.subject ?? null,
            openedAt: conversation.openedAt,
            lastMessageAt: conversation.lastMessageAt ?? null,
            resolvedAt: conversation.resolvedAt ?? null,
            closedAt: conversation.closedAt ?? null,
            createdAt: conversation.createdAt,
            updatedAt: conversation.updatedAt,
            contact: conversation.contact
                    ? {
                        id: conversation.contact.id,
                        displayName: conversation.contact.displayName,
                        firstName: conversation.contact.firstName ?? null,
                        lastName: conversation.contact.lastName ?? null,
                        phone: conversation.contact.phone ?? null,
                        email: conversation.contact.email ?? null,
                        company: conversation.contact.company ?? null,
                        status: conversation.contact.status,
                    } : null,

            channelAccount:
                conversation.channelAccount
                    ? {
                        id: conversation.channelAccount.id,
                        channel: conversation.channelAccount.channel,
                        name: conversation.channelAccount.name,
                        externalAccountId: conversation.channelAccount.externalAccountId ?? null,
                        phoneNumberId: conversation.channelAccount.phoneNumberId ?? null,
                        pageId: conversation.channelAccount.pageId ?? null,
                        instagramAccountId: conversation.channelAccount.instagramAccountId ?? null,
                    }
                    : null,

            assignedUser:
                conversation.assignedUser
                    ? {
                        id: conversation.assignedUser.id,
                        name: conversation.assignedUser.name,
                        email: conversation.assignedUser.email,
                    }
                    : null,

            messages: Array.isArray(conversation.messages)
                    ? conversation.messages.map(
                        (message: any): ConversationMessageDto => ({
                            id: message.id,
                            conversationId: message.conversationId,
                            contactId: message.contactId,
                            senderUserId: message.senderUserId ?? null,
                            direction: message.direction,
                            type: message.type,
                            body: message.body ?? null,
                            mediaUrl: message.mediaUrl ?? null,
                            mimeType: message.mimeType ?? null,
                            externalMessageId: message.externalMessageId ?? null,
                            replyToMessageId: message.replyToMessageId ?? null,
                            status: message.status,
                            metadata: message.metadata ?? null,
                            createdAt: message.createdAt,
                            updatedAt: message.updatedAt,
                        }),
                    )
                    : [],

            labels: ConversationMapper.mapLabels(conversation.labels),
        };
    }


    static toCollection(conversations: any[],): ConversationDto[] 
    {
        return conversations.map(conversation => ConversationMapper.toDto(conversation));
    }


    private static mapLabels(labels: any): ConversationLabelDto[] 
    {
        if (!Array.isArray(labels)) {
            return [];
        }
        return labels
            .map(
                item => {
                    const label = item?.label ?? item;
                    if (!label?.id) {
                        return null;
                    }
                    return {
                        id: label.id,
                        name: label.name ?? label.title ?? 'Label',
                    };
                },
            ).filter((label) : label is ConversationLabelDto => label !== null);
    }
}