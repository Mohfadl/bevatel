import {Router,} from 'express';
import {authMiddleware,} from '../../../middleware/auth.middleware';
import {ContactController,} from '../controllers/contact.controller';
import type {ContactIdentityController,} from '../controllers/contact-identity.controller';

export function createContactRouter(
    contactController: ContactController,
    identityController: ContactIdentityController,
): Router {

    const router = Router(); 
    router.get('/health',
        (_request,response,) => {
            response.status(200).json({
                success: true,
                service: 'contacts',
            });
        },
    );
 
    router.use(authMiddleware); 
    router.get('/',contactController.index);
    router.post('/',contactController.create);
    router.post('/:id/identities',identityController.create);
    router.get('/:id',contactController.show);
    return router;
}