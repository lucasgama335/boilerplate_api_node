import { userPermissionsProvider } from '@/common/composition-root';
import { userPermissionsRepository, userRepository } from '@/database/repositories';
import { UserAccessController } from './user-access.controller';
import { UserAccessService } from './user-access.service';

const userAccessService = new UserAccessService(userRepository, userPermissionsRepository, userPermissionsProvider);

export const userAccessController = new UserAccessController(userAccessService);
