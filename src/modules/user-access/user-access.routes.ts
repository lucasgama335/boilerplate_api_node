import { authMiddleware, authorize } from '@/app/composition-root';
import { validateDataMiddleware } from '@/app/http/middlewares/validate-data-middleware';
import { validateParamsMiddleware } from '@/app/http/middlewares/validate-params-middleware';
import { idParamSchema } from '@/app/schemas/common.schemas';
import { Router } from 'express';
import { setUserPermissionsDTOSchema } from './schemas/user-access.schemas';
import { userAccessController } from './user-access.composition';

export const userAccessRoutes = Router();

userAccessRoutes.post(
    '/:id',
    authMiddleware,
    authorize(['userAccess:manage']),
    validateParamsMiddleware(idParamSchema),
    validateDataMiddleware(setUserPermissionsDTOSchema),
    userAccessController.create,
);
