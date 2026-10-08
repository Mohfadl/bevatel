import type {ContactIdentityDto,} from '../dto/contact.dto';

export class ContactIdentityMapper {
    static toDto(identity: any,): ContactIdentityDto {
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

    static toCollection(identities: any[],): ContactIdentityDto[] 
    {
        return identities.map(identity =>ContactIdentityMapper.toDto(identity,),);
    }
}