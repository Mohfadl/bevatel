import {
    z,
} from 'zod';

import {
    ChannelType,
    ConversationPriority,
    ConversationStatus,
} from '../../../../generated/prisma/client';


const booleanQuery =
    z
        .union([
            z.boolean(),
            z.string(),
        ])
        .transform(
            value => {

                if (
                    typeof value ===
                    'boolean'
                ) {
                    return value;
                }


                return [
                    '1',
                    'true',
                    'yes',
                ].includes(
                    value.toLowerCase(),
                );
            },
        );


export const conversationListQuerySchema =
    z.object({

        status:
            z
                .nativeEnum(
                    ConversationStatus,
                )
                .optional(),

        channel:
            z
                .nativeEnum(
                    ChannelType,
                )
                .optional(),

        channelAccountId:
            z
                .string()
                .uuid()
                .optional(),

        assignedUserId:
            z
                .string()
                .uuid()
                .optional(),

        unassigned:
            booleanQuery
                .optional(),

        search:
            z
                .string()
                .trim()
                .max(255)
                .optional(),

        sort:
            z
                .enum([
                    'newest',
                    'oldest',
                ])
                .default(
                    'newest',
                ),

        page:
            z
                .coerce
                .number()
                .int()
                .positive()
                .default(
                    1,
                ),

        limit:
            z
                .coerce
                .number()
                .int()
                .positive()
                .max(100)
                .default(
                    25,
                ),
    });


export const conversationIdParamsSchema =
    z.object({

        id:
            z
                .string()
                .uuid(),
    });


export const updateConversationStatusSchema =
    z.object({

        status:
            z.nativeEnum(
                ConversationStatus,
            ),
    });


export const assignConversationSchema =
    z.object({

        assignedUserId:
            z
                .string()
                .uuid()
                .nullable(),
    });


export const updateConversationPrioritySchema = z.object({priority: z.nativeEnum(ConversationPriority,)});
export type ConversationListQueryInput = z.infer<typeof conversationListQuerySchema>;
export type UpdateConversationStatusBody = z.infer<typeof updateConversationStatusSchema>;
export type AssignConversationBody = z.infer<typeof assignConversationSchema>;
export type UpdateConversationPriorityBody = z.infer<typeof updateConversationPrioritySchema>;