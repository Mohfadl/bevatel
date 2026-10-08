import {ProfileController,} from './controllers/profile.controller';
import {PrismaProfileRepository,} from './repositories/prisma-profile.repository';
import {createProfileRouter,} from './routes/profile.routes';
import {ProfileService,} from './services/profile.service';

const profileRepository = new PrismaProfileRepository();
const profileService =new ProfileService(profileRepository,);
const profileController =new ProfileController(profileService,);
const profileRouter = createProfileRouter(profileController,);

export {
    profileRepository,
    profileService,
    profileController,
    profileRouter,
};

export {ProfileController,} from './controllers/profile.controller';

export {
    ProfileService,
    ProfileNotFoundError,
    ProfileEmailAlreadyExistsError,
    InvalidCurrentPasswordError,
} from './services/profile.service';

export {PrismaProfileRepository,} from './repositories/prisma-profile.repository';
export type {
    ProfileRepository,
    UpdateProfileData,
} from './repositories/profile.repository';

export type {ProfileDto,} from './dto/profile.dto';

export {
    updateProfileSchema,
    updatePasswordSchema,
} from './validators/profile.validator';


export type {
    UpdateProfileBody,
    UpdatePasswordBody,
} from './validators/profile.validator';