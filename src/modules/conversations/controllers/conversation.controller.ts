import type {
    NextFunction,
    Response,
} from 'express';

import {
    ZodError,
} from 'zod';

import type {AuthenticatedRequest,} from '../../../middleware/auth.middleware';

import type {ConversationService,} from '../services/conversation.service';

import {ConversationNotFoundError,} from '../services/conversation.service';

import {
    assignConversationSchema,
    conversationIdParamsSchema,
    conversationListQuerySchema,
    updateConversationPrioritySchema,
    updateConversationStatusSchema,
} from '../validators/conversation.validator';


export class ConversationController {

    constructor(private readonly conversationService: ConversationService,) {}

    /**
     * GET /api/conversations
     */
    index = async (request: AuthenticatedRequest,response: Response,next: NextFunction): Promise<void> => {

        try {
            const organizationId = this.getOrganizationId(request);
            const query = conversationListQuerySchema.parse(request.query);
            const result = await this.conversationService.list(organizationId,query);
            response.status(200).json({
                success: true,
                data: result.conversations,
                conversations: result.conversations,
                pagination: result.pagination,
            });

        } catch (error) {

            this.handleError(error,response,next);
        }
    };


    /**
     * GET /api/conversations/:id
     */
    show = async (request: AuthenticatedRequest,response: Response,next: NextFunction): Promise<void> => {
        try {

            const organizationId = this.getOrganizationId(request);
            const params = conversationIdParamsSchema.parse(request.params,);
            const conversation =
                await this.conversationService.getById(
                    organizationId,
                    params.id,
                );

            response.status(200).json({
                success: true,
                data: conversation,
                conversation,
            });

        } catch (error) {
            this.handleError(error,response,next);
        }
    };


    /**
     * PATCH /api/conversations/:id/status
     */
    updateStatus = async (request: AuthenticatedRequest,response: Response,next: NextFunction): Promise<void> => {
        try {
            const organizationId = this.getOrganizationId(request);
            const params = conversationIdParamsSchema.parse(request.params,);
            const body = updateConversationStatusSchema.parse(request.body,);
            const conversation =
                await this.conversationService.updateStatus(
                    organizationId,
                    params.id,
                    body.status,
                );

            response.status(200).json({
                success: true,
                message: 'Conversation status updated successfully.',
                data: conversation,
                conversation,
            });

        } catch (error) {

            this.handleError(error,response,next);
        }
    };


    /**
     * PATCH /api/conversations/:id/assignment
     */
    assign = async (request: AuthenticatedRequest,response: Response,next: NextFunction): Promise<void> => {
        try {
            const organizationId = this.getOrganizationId(request);
            const params = conversationIdParamsSchema.parse(request.params);
            const body = assignConversationSchema.parse(request.body);
            const conversation =
                await this.conversationService.assign(
                    organizationId,
                    params.id,
                    body.assignedUserId,
                );

            response.status(200).json({
                success: true,
                message: body.assignedUserId ? 'Conversation assigned successfully.' : 'Conversation unassigned successfully.',
                data: conversation,
                conversation,
            });

        } catch (error) {
            this.handleError(error,response,next);
        }
    };


    /**
     * PATCH /api/conversations/:id/priority
     */
    updatePriority = async (request: AuthenticatedRequest,response: Response,next: NextFunction): Promise<void> => {
        try {

            const organizationId = this.getOrganizationId(request);
            const params = conversationIdParamsSchema.parse(request.params);
            const body = updateConversationPrioritySchema.parse(request.body);
            const conversation =
                await this.conversationService.updatePriority(
                    organizationId,
                    params.id,
                    body.priority,
                );

            response.status(200).json({
                success: true,
                message: 'Conversation priority updated successfully.',
                data: conversation,
                conversation,
            });

        } catch (error) {
            this.handleError(error,response,next);
        }
    };


    /**
     * Get authenticated organization.
     *
     * organizationId must come from the authenticated user,
     * never from request body/query parameters.
     */
    private getOrganizationId(request: AuthenticatedRequest): string {
        const organizationId = request.user?.organizationId;
        if (!organizationId) {
            throw new Error('Authenticated organization is missing from request.',);
        }
        return organizationId;
    }


    private handleError(error: unknown,response: Response,next: NextFunction): void {
        if (error instanceof ConversationNotFoundError ) {
            response.status(404).json({
                success: false,
                message: error.message,
            });
            return;
        }

        if (error instanceof ZodError ) {
            response.status(422).json({
                success: false,
                message: 'Invalid request data.',
                errors: error.issues,
            });
            return;
        }
        next(error);
    }
}