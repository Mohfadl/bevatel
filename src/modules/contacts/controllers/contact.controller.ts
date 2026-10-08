import type {
    NextFunction,
    Response,
} from 'express';
import {ZodError,} from 'zod';
import type {AuthenticatedRequest,} from '../../../middleware/auth.middleware';
import type {ContactService,} from '../services/contact.service';
import {
    ContactNotFoundError,
    DuplicateContactEmailError,
    DuplicateContactIdentityError,
    DuplicateContactPhoneError,
} from '../services/contact.service';

import {
    contactIdParamsSchema,
    contactListQuerySchema,
    createContactIdentitySchema,
    createContactSchema,
} from '../validators/contact.validator';

export class ContactController { constructor(private readonly contactService:ContactService,) {}

    index = async (request: AuthenticatedRequest,response: Response,next: NextFunction): Promise<void> => {
        try {
            const organizationId = this.getOrganizationId(request);
            const query = contactListQuerySchema.parse(request.query);
            const result = await this.contactService.list(organizationId,query);
            response.status(200).json({
                success: true,
                data: {
                    contacts: result.contacts,
                    pagination: result.pagination,
                },
            });
        } catch (error) {
            this.handleError(error,response,next);
        }
    };

    show = async (request: AuthenticatedRequest,response: Response,next: NextFunction,): Promise<void> => {
        try {
            const organizationId = this.getOrganizationId(request,);
            const params = contactIdParamsSchema.parse(request.params,);
            const contact = await this.contactService.getById(organizationId,params.id,);
            response.status(200).json({
                success: true,
                data: contact,
            });
        } catch (error) {
            this.handleError(error,response,next,);
        }
    };

    create = async (request: AuthenticatedRequest,response: Response,next: NextFunction,): Promise<void> => {
        try {
            const organizationId = this.getOrganizationId(request,);
            const body = createContactSchema.parse(request.body,);
            const contact =
                await this.contactService.create({
                    organizationId,
                    displayName: body.displayName,
                    firstName: body.firstName,
                    lastName: body.lastName,
                    email: body.email,
                    phone: body.phone,
                    company: body.company,
                    bio: body.bio,
                    attributes: body.attributes,
                    status: body.status,
                });

            response.status(201).json({
                success: true,
                message: 'Contact created successfully',
                data: contact,
            });
        } catch (error) {
            this.handleError(error, response, next, );
        }
    };

    createIdentity = async (request: AuthenticatedRequest,response: Response,next: NextFunction): Promise<void> => {
        try {
            const organizationId = this.getOrganizationId(request,);
            const params = contactIdParamsSchema.parse(request.params,);
            const body = createContactIdentitySchema.parse(request.body,);
            const identity = await this.contactService.createIdentity({
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

    private handleError(error: unknown,response: Response,next: NextFunction,): void 
    {
        if (error instanceof ContactNotFoundError ) {
            response.status(404).json({
                success: false,
                message: error.message,
            });
            return;
        }

        if (error instanceof DuplicateContactPhoneError || error instanceof DuplicateContactEmailError || error instanceof DuplicateContactIdentityError) {
            response.status(409).json({
                success: false,
                message: error.message,
            });
            return;
        }

        if (error instanceof ZodError) {
            response.status(422).json({
                success: false,
                message: 'Validation failed',
                errors: error.flatten(),
            });
            return;
        }
        next(error);
    }
}