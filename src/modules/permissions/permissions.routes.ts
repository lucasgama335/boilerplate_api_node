import { authMiddleware, authorize } from '@/app/composition-root';
import { validateDataMiddleware } from '@/app/http/middlewares/validate-data-middleware';
import { validateParamsMiddleware } from '@/app/http/middlewares/validate-params-middleware';
import { validateQueryMiddleware } from '@/app/http/middlewares/validate-query-middleware';
import { createPaginationSchema, idParamSchema } from '@/app/schemas/common.schemas';
import { Router } from 'express';
import { permissionsController } from './permissions.composition';
import { permissionsCreateSchema, permissionsUpdateSchema } from './schemas/permissions.schemas';

export const permissionsRoutes = Router();

permissionsRoutes.get('/', authMiddleware, authorize(['permissions:show']), validateQueryMiddleware(createPaginationSchema()), permissionsController.list);
permissionsRoutes.get('/:id', authMiddleware, authorize(['permissions:show']), validateParamsMiddleware(idParamSchema), permissionsController.show);
permissionsRoutes.post('/', authMiddleware, authorize(['permissions:create']), validateDataMiddleware(permissionsCreateSchema), permissionsController.create);
permissionsRoutes.patch(
    '/:id',
    authMiddleware,
    authorize(['permissions:update']),
    validateParamsMiddleware(idParamSchema),
    validateDataMiddleware(permissionsUpdateSchema),
    permissionsController.update,
);
permissionsRoutes.delete('/:id', authMiddleware, authorize(['permissions:delete']), validateParamsMiddleware(idParamSchema), permissionsController.delete);
