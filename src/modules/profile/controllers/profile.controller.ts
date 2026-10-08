import type {NextFunction,Response,} from 'express';
import {ZodError,} from 'zod';
import type {AuthenticatedRequest,} from '../../../middleware/auth.middleware';
import type {ProfileService,} from '../services/profile.service';
import {
    InvalidCurrentPasswordError,
    ProfileEmailAlreadyExistsError,
    ProfileNotFoundError,
} from '../services/profile.service';

import {
    updatePasswordSchema,
    updateProfileSchema,
} from '../validators/profile.validator';

export class ProfileController {
    constructor(
        private readonly profileService: ProfileService,
    ) {}


    /**
     * GET /api/profile
     */
    show = async (
        request: AuthenticatedRequest,
        response: Response,
        next: NextFunction,
    ): Promise<void> => {
        try {
            const auth = this.getAuthenticatedUser(request,);
            const profile = await this.profileService.getProfile(auth.userId,auth.organizationId);
            response.status(200).json({
                success: true,
                data: profile,
            });

        } catch (error) {
            this.handleError(error,response,next,);
        }
    };


    /**
     * PATCH /api/profile
     */
    update = async (
        request: AuthenticatedRequest,
        response: Response,
        next: NextFunction,
    ): Promise<void> => {

        try {
            const auth =this.getAuthenticatedUser(request,);
            const body = updateProfileSchema.parse(request.body,);
            const profile =
                await this.profileService.updateProfile(
                    auth.userId,
                    auth.organizationId,
                    body,
                );

            response.status(200).json({
                success: true,
                message: 'Profile updated successfully.',
                data: profile,
            });

        } catch (error) {
            this.handleError(error,response,next,);
        }
    };


    /**
     * PATCH /api/profile/password
     */
    updatePassword = async (
        request: AuthenticatedRequest,
        response: Response,
        next: NextFunction,
    ): Promise<void> => {

        try {
            const auth = this.getAuthenticatedUser(request,);
            const body = updatePasswordSchema.parse(request.body,);
            await this.profileService.updatePassword(
                auth.userId,
                auth.organizationId,
                body,
            );

            response.status(200).json({
                success: true,
                message: 'Password updated successfully.',
            });

        } catch (error) {
            this.handleError(
                error,
                response,
                next,
            );
        }
    };

    private getAuthenticatedUser(request: AuthenticatedRequest,): {userId: string;organizationId: string;} 
    {
        const userId = request.user?.id;
        const organizationId = request.user?.organizationId;
        if (!userId || !organizationId ) {
            throw new Error('Authenticated user context is missing from request.',);
        }

        return {
            userId,
            organizationId,
        };
    }

    private handleError(error: unknown,response: Response,next: NextFunction,): void 
    {
        if (error instanceof ProfileNotFoundError ) {
            response.status(404).json({
                success: false,
                message: error.message,
            });
            return;
        }

        if (error instanceof ProfileEmailAlreadyExistsError ) {
            response.status(409).json({
                success: false,
                message: error.message,
            });
            return;
        }

        if (error instanceof InvalidCurrentPasswordError ) {
            response.status(422).json({
                success: false,
                message: error.message,
            });
            return;
        }

        if (error instanceof ZodError ) {
            response.status(422).json({
                success: false,
                message: 'Validation failed.',
                errors: error.issues,
            });
            return;
        }
        next(error,);
    }
}