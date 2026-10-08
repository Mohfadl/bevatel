import {ConversationController} from './controllers/conversation.controller';
import {PrismaConversationRepository} from './repositories/prisma-conversation.repository';
import {createConversationRouter} from './routes/conversation.routes';
import {ConversationService} from './services/conversation.service';

const conversationRepository = new PrismaConversationRepository();
const conversationService = new ConversationService(conversationRepository);
const conversationController = new ConversationController(conversationService);
const conversationRouter = createConversationRouter(conversationController);

export {
    conversationRepository,
    conversationService,
    conversationController,
    conversationRouter,
};

export type {ConversationRepository} from './repositories/conversation.repository';
export type {
    ConversationDto,
    ConversationContactDto,
    ConversationChannelAccountDto,
    ConversationAssignedUserDto,
    ConversationMessageDto,
    ConversationLabelDto,
    ConversationListResponseDto,
} from './dto/conversation.dto';

export type {ConversationQueryDto} from './dto/conversation-query.dto';
export type {
    ConversationSort,
    ConversationListQuery,
    ConversationPagination,
    ConversationListResult,
    UpdateConversationStatusInput,
    AssignConversationInput,
    UpdateConversationPriorityInput,
} from './types/conversation.types';

export {
    ConversationService,
    ConversationNotFoundError,
} from './services/conversation.service';
export {ConversationController} from './controllers/conversation.controller';
export {PrismaConversationRepository} from './repositories/prisma-conversation.repository';
export {ConversationMapper} from './mappers/conversation.mapper';


export {
    conversationListQuerySchema,
    conversationIdParamsSchema,
    updateConversationStatusSchema,
    assignConversationSchema,
    updateConversationPrioritySchema,
} from './validators/conversation.validator';