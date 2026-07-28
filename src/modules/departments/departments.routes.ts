import { authMiddleware, authorize } from '@/app/composition-root';
import { validateDataMiddleware } from '@/app/http/middlewares/validate-data-middleware';
import { validateParamsMiddleware } from '@/app/http/middlewares/validate-params-middleware';
import { validateQueryMiddleware } from '@/app/http/middlewares/validate-query-middleware';
import { idParamSchema } from '@/app/schemas/common.schemas';
import { Router } from 'express';
import { departmentsController } from './departments.composition';
import { departmentsCreateSchema, departmentsListQuerySchema, departmentsUpdateSchema } from './schemas/departments.schemas';

export const departmentsRoutes = Router();

departmentsRoutes.get('/', authMiddleware, authorize(['departments:show']), validateQueryMiddleware(departmentsListQuerySchema), departmentsController.list);
departmentsRoutes.get('/:id', authMiddleware, authorize(['departments:show']), validateParamsMiddleware(idParamSchema), departmentsController.show);
departmentsRoutes.post('/', authMiddleware, authorize(['departments:create']), validateDataMiddleware(departmentsCreateSchema), departmentsController.create);
departmentsRoutes.patch(
    '/:id',
    authMiddleware,
    authorize(['departments:update']),
    validateParamsMiddleware(idParamSchema),
    validateDataMiddleware(departmentsUpdateSchema),
    departmentsController.update,
);
departmentsRoutes.delete('/:id', authMiddleware, authorize(['departments:delete']), validateParamsMiddleware(idParamSchema), departmentsController.delete);
