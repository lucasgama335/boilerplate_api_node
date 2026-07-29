import { userPermissionsService } from '@/app/composition-root';
import { departmentsRepository } from '@/database/repositories';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';

const departmentsService = new DepartmentsService(departmentsRepository, userPermissionsService);

export const departmentsController = new DepartmentsController(departmentsService);
