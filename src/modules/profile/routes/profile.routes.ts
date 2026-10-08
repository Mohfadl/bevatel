import {Router,} from 'express';
import {authMiddleware,} from '../../../middleware/auth.middleware';
import type {ProfileController,} from '../controllers/profile.controller';

export function createProfileRouter(controller: ProfileController,): Router {
    const router = Router();
    /*
    |--------------------------------------------------------------------------
    | Profile Authentication
    |--------------------------------------------------------------------------
    */
    router.use(authMiddleware);
    /*
     * GET /api/profile
     */
    router.get('/',controller.show);

    /*
     * PATCH /api/profile
     */
    router.patch('/',controller.update);

    /*
     * PATCH /api/profile/password
     */
    router.patch('/password',controller.updatePassword);
    return router;
}