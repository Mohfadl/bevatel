import type {
    NextFunction,
    Request,
    Response,
} from 'express';

import jwt, {
    type JwtPayload,
} from 'jsonwebtoken';

import prisma from '../../shared/prisma';


/*
|--------------------------------------------------------------------------
| Authenticated User
|--------------------------------------------------------------------------
*/

export interface AuthenticatedUser {
    id: string;
    organizationId: string;
    name: string;
    email: string;
    role: string;
}


/*
|--------------------------------------------------------------------------
| Authenticated Request
|--------------------------------------------------------------------------
*/

export interface AuthenticatedRequest extends Request {
    user?: AuthenticatedUser;
}


/*
|--------------------------------------------------------------------------
| JWT Payload
|--------------------------------------------------------------------------
*/

interface AccessTokenPayload extends JwtPayload {
    id?: string;
    userId?: string;
    organizationId?: string;
    email?: string;
    role?: string;
}


/*
|--------------------------------------------------------------------------
| Authentication Middleware
|--------------------------------------------------------------------------
*/

export async function authMiddleware(
    request: AuthenticatedRequest,
    response: Response,
    next: NextFunction,
): Promise<void> {

    try {

        /*
        |--------------------------------------------------------------------------
        | 1. Read Authorization Header
        |--------------------------------------------------------------------------
        */

        const authorizationHeader =
            request.headers.authorization;

        if (!authorizationHeader) {
            response.status(401).json({
                success: false,
                message: 'Authorization header is required.',
            });

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | 2. Validate Bearer Token Format
        |--------------------------------------------------------------------------
        */

        const [
            scheme,
            token,
        ] = authorizationHeader.split(' ');

        if (
            scheme?.toLowerCase() !== 'bearer' ||
            !token
        ) {
            response.status(401).json({
                success: false,
                message: 'Invalid authorization header.',
            });

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | 3. Get JWT Secret
        |--------------------------------------------------------------------------
        */

        const jwtSecret =
            process.env.JWT_SECRET;

        if (!jwtSecret) {
            console.error(
                'JWT_SECRET is not configured.',
            );

            response.status(500).json({
                success: false,
                message:
                    'Authentication configuration error.',
            });

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | 4. Verify JWT
        |--------------------------------------------------------------------------
        */

        let decoded: AccessTokenPayload;

        try {

            const payload =
                jwt.verify(
                    token,
                    jwtSecret,
                );

            if (typeof payload === 'string') {
                response.status(401).json({
                    success: false,
                    message:
                        'Invalid access token.',
                });

                return;
            }

            decoded =
                payload as AccessTokenPayload;

        } catch (error) {

            if (
                error instanceof
                jwt.TokenExpiredError
            ) {
                response.status(401).json({
                    success: false,
                    message:
                        'Access token has expired.',
                });

                return;
            }

            response.status(401).json({
                success: false,
                message:
                    'Invalid access token.',
            });

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | 5. Resolve User ID
        |--------------------------------------------------------------------------
        */

        const userId =
            decoded.id ??
            decoded.userId;

        if (!userId) {
            response.status(401).json({
                success: false,
                message:
                    'Invalid access token payload.',
            });

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | 6. Load User From Database
        |--------------------------------------------------------------------------
        */

        const user =
            await prisma.user.findUnique({
                where: {
                    id: userId,
                },

                select: {
                    id: true,
                    organizationId: true,
                    name: true,
                    email: true,
                    role: true,
                    status: true,
                },
            });


        /*
        |--------------------------------------------------------------------------
        | 7. Validate User
        |--------------------------------------------------------------------------
        */

        if (!user) {
            response.status(401).json({
                success: false,
                message:
                    'User not found.',
            });

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | 8. Check User Status
        |--------------------------------------------------------------------------
        */

        if (user.status !== 'ACTIVE') {
            response.status(403).json({
                success: false,
                message:
                    'User account is not active.',
            });

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | 9. Attach Authenticated User
        |--------------------------------------------------------------------------
        */

        request.user = {
            id: user.id,
            organizationId:
                user.organizationId,
            name: user.name,
            email: user.email,
            role: user.role,
        };


        /*
        |--------------------------------------------------------------------------
        | 10. Continue
        |--------------------------------------------------------------------------
        */

        next();

    } catch (error) {

        console.error(
            'Authentication middleware error:',
            error,
        );

        response.status(500).json({
            success: false,
            message:
                'Authentication failed.',
        });
    }
}


/*
|--------------------------------------------------------------------------
| Role Authorization Middleware
|--------------------------------------------------------------------------
|
| Usage:
|
| allowRoles('SUPER_ADMIN', 'ADMIN')
|
| The middleware MUST run after authMiddleware because request.user
| is populated by authMiddleware.
|
*/

export function allowRoles(
    ...allowedRoles: string[]
) {

    return (
        request: AuthenticatedRequest,
        response: Response,
        next: NextFunction,
    ): void => {

        /*
        |--------------------------------------------------------------------------
        | 1. Make Sure User Is Authenticated
        |--------------------------------------------------------------------------
        */

        if (!request.user) {

            response.status(401).json({
                success: false,
                message: 'Unauthorized.',
            });

            return;
        }


        /*
        |--------------------------------------------------------------------------
        | 2. Check Role
        |--------------------------------------------------------------------------
        */

        if (
            !allowedRoles.includes(
                request.user.role,
            )
        ) {

            response.status(403).json({
                success: false,
                message:
                    'You do not have permission to perform this action.',
            });

            return;
        } 

        next();
    };
}