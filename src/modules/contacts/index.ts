import {ContactController,} from './controllers/contact.controller';
import {ContactIdentityController,} from './controllers/contact-identity.controller';
import {PrismaContactRepository,} from './repositories/prisma-contact.repository';
import {PrismaContactIdentityRepository,} from './repositories/prisma-contact-identity.repository';
import {ContactService,} from './services/contact.service';
import {ContactIdentityService,} from './services/contact-identity.service';
import {createContactRouter,} from './routes/contact.routes';

const contactRepository = new PrismaContactRepository();
const contactIdentityRepository = new PrismaContactIdentityRepository();
const contactService =new ContactService(contactRepository,);
const contactIdentityService = new ContactIdentityService(contactRepository,contactIdentityRepository,);
const contactController =new ContactController(contactService,);
const contactIdentityController =new ContactIdentityController(contactIdentityService,);

const contactRouter = createContactRouter(contactController, contactIdentityController);
export {
    contactRepository,
    contactIdentityRepository,
    contactService,
    contactIdentityService,
    contactController,
    contactIdentityController,
    contactRouter,
};

export {ContactController,} from './controllers/contact.controller';
export {ContactIdentityController,} from './controllers/contact-identity.controller';
export {ContactService,} from './services/contact.service';
export {ContactIdentityService,} from './services/contact-identity.service';
export {PrismaContactRepository,} from './repositories/prisma-contact.repository';
export {PrismaContactIdentityRepository,} from './repositories/prisma-contact-identity.repository';
export type {ContactRepository,} from './repositories/contact.repository';
export type {ContactIdentityRepository,} from './repositories/contact-identity.repository';
export {ContactMapper,} from './mappers/contact.mapper';
export {ContactIdentityMapper,} from './mappers/contact-identity.mapper';


export {
    ContactNotFoundError,
    DuplicateContactPhoneError,
    DuplicateContactEmailError,
    DuplicateContactIdentityError,
} from './errors/contact.errors';