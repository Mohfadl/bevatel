import {Router} from 'express';
import {ConversationController} from '../controllers/conversation.controller';

export function createConversationRouter(controller: ConversationController): Router 
{
    const router = Router();
    /*
     * GET /api/conversations
     */
    router.get('/',controller.index);
    /*
     * GET /api/conversations/:id
     */
    router.get('/:id',controller.show);
    /*
     * PATCH /api/conversations/:id/status
     *
     * {
     *     "status": "RESOLVED"
     * }
     */
    router.patch('/:id/status',controller.updateStatus);
    /*
     * PATCH /api/conversations/:id/assignment
     *
     * {
     *     "assignedUserId": "uuid"
     * }
     *
     * Unassign:
     *
     * {
     *     "assignedUserId": null
     * }
     */
    router.patch('/:id/assignment',controller.assign);
    /*
     * PATCH /api/conversations/:id/priority
     *
     * {
     *     "priority": "HIGH"
     * }
     */
    router.patch('/:id/priority',controller.updatePriority);
    return router;
}