import { permissionsRepository } from '@/database/repositories';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';

const permissionsService = new PermissionsService(permissionsRepository);

export const permissionsController = new PermissionsController(permissionsService);
