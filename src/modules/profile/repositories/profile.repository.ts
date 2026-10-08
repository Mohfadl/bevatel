export interface UpdateProfileData {
    name?: string;
    email?: string;
}

export interface ProfileRepository {
    findById(userId: string,organizationId: string,): Promise<unknown | null>;
    findByEmail(email: string,): Promise<unknown | null>;
    update(userId: string,organizationId: string,data: UpdateProfileData,): Promise<unknown>;
    updatePassword(userId: string,organizationId: string,passwordHash: string,): Promise<void>;
}