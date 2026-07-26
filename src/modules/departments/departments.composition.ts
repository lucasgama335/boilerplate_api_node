import { departmentsRepository } from '@/database/repositories';
import { DepartmentsController } from './departments.controller';
import { DepartmentsService } from './departments.service';

const departmentsService = new DepartmentsService(departmentsRepository);

export const departmentsController = new DepartmentsController(departmentsService);
