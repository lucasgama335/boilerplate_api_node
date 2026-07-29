import { userPermissionsService } from '@/app/composition-root';
import { permissionsRepository } from '@/database/repositories';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

const permissionsService = new PermissionsService(permissionsRepository, userPermissionsService);

export const permissionsController = new PermissionsController(permissionsService);
