import {
    compare,
    hash,
} from 'bcryptjs';

import type {
    ProfileDto,
} from '../dto/profile.dto';

import type {
    ProfileRepository,
} from '../repositories/profile.repository';

import type {
    UpdatePasswordBody,
    UpdateProfileBody,
} from '../validators/profile.validator';


type StoredProfile = {
    id: string;
    organizationId: string;
    name: string;
    email: string;
    passwordHash: string;
    role: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
};

type ExistingEmailUser = {
    id: string;
    organizationId: string;
    email: string;
};

export class ProfileNotFoundError
extends Error {
    constructor() {
        super('Profile not found.',);
        this.name = 'ProfileNotFoundError';
    }
}

export class ProfileEmailAlreadyExistsError
extends Error {
    constructor() {
        super('This email address is already in use.',);
        this.name = 'ProfileEmailAlreadyExistsError';
    }
}

export class InvalidCurrentPasswordError
extends Error {
    constructor() {
        super('Current password is incorrect.',);
        this.name = 'InvalidCurrentPasswordError';
    }
}

export class ProfileService {
    constructor(
        private readonly profileRepository: ProfileRepository,
    ) {}


    async getProfile(userId: string, organizationId: string, ): Promise<ProfileDto> {
        const profile = await this.profileRepository.findById(userId, organizationId) as StoredProfile | null;
        if (!profile) {
            throw new ProfileNotFoundError();
        }
        return this.toProfileDto(profile,);
    }

    async updateProfile(
        userId: string,
        organizationId: string,
        data: UpdateProfileBody,
    ): Promise<ProfileDto> {

        const currentProfile =
            await this.profileRepository.findById(
                userId,
                organizationId,
            ) as StoredProfile | null;


        if (!currentProfile) {
            throw new ProfileNotFoundError();
        }

        if (data.email && data.email !== currentProfile.email.toLowerCase() ) {
            const existingUser = await this.profileRepository.findByEmail(data.email,) as ExistingEmailUser | null;
            if (existingUser && existingUser.id !== userId ) {
                throw new ProfileEmailAlreadyExistsError();
            }
        }


        const updatedProfile =
            await this.profileRepository.update(
                userId,
                organizationId,
                {
                    name: data.name,
                    email: data.email,
                },
            ) as StoredProfile | null;

        if (!updatedProfile) {
            throw new ProfileNotFoundError();
        }
        return this.toProfileDto(updatedProfile,);
    }


    async updatePassword(userId: string,organizationId: string,data: UpdatePasswordBody,): Promise<void> 
    {
        const profile = await this.profileRepository.findById(userId,organizationId,) as StoredProfile | null;
        if (!profile) {
            throw new ProfileNotFoundError();
        }

        const passwordMatches = await compare(data.currentPassword,profile.passwordHash,);
        if (!passwordMatches) {
            throw new InvalidCurrentPasswordError();
        }

        const newPasswordHash = await hash(data.newPassword,12,);
        await this.profileRepository.updatePassword(
            userId,
            organizationId,
            newPasswordHash,
        );
    }


    private toProfileDto(profile: StoredProfile,): ProfileDto 
    {
        return {
            id: profile.id,
            organizationId: profile.organizationId,
            name: profile.name,
            email: profile.email,
            role: profile.role,
            status: profile.status,
            createdAt: profile.createdAt,
            updatedAt: profile.updatedAt,
        };
    }
}