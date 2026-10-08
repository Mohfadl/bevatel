import type {ContactStatus} from '../../../../generated/prisma/client';
import type {ContactSort} from '../types/contact.types';

export interface ContactQueryDto {
    search?: string;
    status?: ContactStatus;
    sort: ContactSort;
    page: number;
    perPage: number;
}