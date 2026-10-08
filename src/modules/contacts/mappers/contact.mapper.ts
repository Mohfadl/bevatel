import type {
    ContactConversationDto,
    ContactDto,
    ContactIdentityDto,
} from '../dto/contact.dto';


export class ContactMapper {
    static toDto(contact: any): ContactDto {
        const result: ContactDto = {
                id: contact.id,
                organizationId: contact.organizationId,
                displayName: contact.displayName,
                firstName: contact.firstName ?? null,
                lastName: contact.lastName ?? null,
                phone: contact.phone ?? null,
                email: contact.email ?? null,
                company: contact.company ?? null,
                bio: contact.bio ?? null,
                attributes: contact.attributes ?? null,
                status: contact.status,
                createdAt: contact.createdAt,
                updatedAt: contact.updatedAt,
                identities: ContactMapper.mapIdentities(contact.identities),
            };

        if (Array.isArray(contact.conversations)) {
            result.conversations = contact.conversations.map((conversation: any): ContactConversationDto => ({
                        id: conversation.id,
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
                    }),
                );
        }
        return result;
    }

    static toCollection(contacts: any[]): ContactDto[] 
    {
        return contacts.map(contact => ContactMapper.toDto(contact));
    }

    static identityToDto(identity: any): ContactIdentityDto 
    {
        return {
            id: identity.id,
            channel: identity.channel,
            externalId: identity.externalId,
            username: identity.username ?? null,
            phone: identity.phone ?? null,
            email: identity.email ?? null,
            metadata: identity.metadata ?? null,
            createdAt: identity.createdAt,
            updatedAt: identity.updatedAt,
        };
    }

    private static mapIdentities(identities: any): ContactIdentityDto[] 
    {
        if (!Array.isArray(identities,)) {
            return [];
        }
        return identities.map(identity => ContactMapper.identityToDto(identity));
    }
}