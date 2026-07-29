import { userPermissionsProvider } from '@/common/composition-root';
import { permissionsRepository } from '@/database/repositories';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

const permissionsService = new PermissionsService(permissionsRepository, userPermissionsProvider);

export const permissionsController = new PermissionsController(permissionsService);
