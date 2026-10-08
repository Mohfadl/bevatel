import {z,} from 'zod';
export const updateProfileSchema =
            z.object({
                    name: z.string()
                            .trim()
                            .min(2,'Name must contain at least 2 characters.',)
                            .max(150,'Name cannot exceed 150 characters.',)
                            .optional(),

                    email: z.string()
                            .trim()
                            .email('Please enter a valid email address.',)
                            .max(255,'Email cannot exceed 255 characters.',).transform(value => value.toLowerCase(),).optional(),
                })
                .refine(data => data.name !== undefined || data.email !== undefined,
                    {
                        message: 'At least one profile field must be provided.',
                    },
                );

export const updatePasswordSchema = 
            z.object({
                currentPassword: z.string().min(1,'Current password is required.',),
                newPassword: z.string().min(8,'New password must contain at least 8 characters.',).max(255,'Password is too long.',),
                newPasswordConfirmation: z.string().min(1,'Password confirmation is required.',),
            })
            .refine(data => data.newPassword === data.newPasswordConfirmation,
                {
                    message: 'New password confirmation does not match.',
                    path: ['newPasswordConfirmation'],
                },
            )
            .refine(data => data.currentPassword !== data.newPassword,
                {
                    message: 'New password must be different from the current password.',
                    path: ['newPassword'],
                },
            );

export type UpdateProfileBody = z.infer<typeof updateProfileSchema>;
export type UpdatePasswordBody = z.infer<typeof updatePasswordSchema>;