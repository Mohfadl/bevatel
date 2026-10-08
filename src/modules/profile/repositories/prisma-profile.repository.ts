import prisma from '../../../../shared/prisma';

import type {
    ProfileRepository,
    UpdateProfileData,
} from './profile.repository';


const profileSelect = {
    id: true,
    organizationId: true,
    name: true,
    email: true,
    passwordHash: true,
    role: true,
    status: true,
    createdAt: true,
    updatedAt: true,
} as const;


export class PrismaProfileRepository
implements ProfileRepository {

    async findById(userId: string,organizationId: string,): Promise<unknown | null> {
        return prisma.user.findFirst({
            where: {
                id: userId,
                organizationId,
            },
            select: profileSelect,
        });
    }

    async findByEmail(email: string,): Promise<unknown | null> {

        return prisma.user.findFirst({
            where: {
                email,
            },

            select: {
                id: true,
                organizationId: true,
                email: true,
            },
        });
    }


    async update(
        userId: string,
        organizationId: string,
        data: UpdateProfileData,
    ): Promise<unknown> {

        const result = await prisma.user.updateMany({
                where: {
                    id: userId,
                    organizationId,
                },
                data: {
                    ...(data.name !== undefined ? {name: data.name,} : {}),
                    ...(data.email !== undefined ? {email:data.email} : {}),
                },
            });
        if (result.count === 0) {
            return null;
        }
        return this.findById(userId,organizationId,);
    }


    async updatePassword(userId: string,organizationId: string,passwordHash: string,): Promise<void> {

        await prisma.user.updateMany({
            where: {
                id: userId,
                organizationId,
            },

            data: {
                passwordHash,
            },
        });
    }
}