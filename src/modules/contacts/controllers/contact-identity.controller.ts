import type {NextFunction,Response,} from 'express';
import {ZodError,} from 'zod';
import type {AuthenticatedRequest,} from '../../../middleware/auth.middleware';
import {ContactNotFoundError,DuplicateContactIdentityError,} from '../errors/contact.errors';
import type {ContactIdentityService,} from '../services/contact-identity.service';
import {contactIdParamsSchema,} from '../validators/contact.validator';
import {createContactIdentitySchema, } from '../validators/contact-identity.validator';

export class ContactIdentityController {

    constructor(private readonly contactIdentityService: ContactIdentityService) {}
    create = async (request: AuthenticatedRequest,response: Response,next: NextFunction,): Promise<void> => {
        try {
            const organizationId = this.getOrganizationId(request,);
            const params = contactIdParamsSchema.parse(request.params,);
            const body = createContactIdentitySchema.parse(request.body,);
            const identity = await this.contactIdentityService.create({
                    organizationId,
                    contactId: params.id,
                    channel: body.channel,
                    externalId: body.externalId,
                    username: body.username,
                    phone: body.phone,
                    email: body.email,
                    metadata: body.metadata,
                });

            response.status(201).json({
                success: true,
                message: 'Contact identity created successfully',
                data: identity,
            });

        } catch (error) {
            this.handleError(error,response,next,);
        }
    };

    private getOrganizationId(request: AuthenticatedRequest,): string {
        const organizationId = request.user?.organizationId;
        if (!organizationId) {
            throw new Error('Authenticated organization is missing from request.',);
        }
        return organizationId;
    }

    private handleError( error: unknown, response: Response, next: NextFunction, ): void {
        if (error instanceof ContactNotFoundError ) {
            response.status(404).json({
                success: false,
                message: error.message,
            });
            return;
        }

        if (error instanceof DuplicateContactIdentityError ) {
            response.status(409).json({
                success: false,
                message: error.message,
            });
            return;
        }

        if (error instanceof ZodError ) {
            response.status(422).json({
                success: false,
                message: 'Validation failed',
                errors: error.flatten(),
            });
            return;
        }
        next(error,);
    }
}