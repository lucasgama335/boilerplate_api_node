import { authMiddleware, authorize } from '@/common/composition-root';
import { validateDataMiddleware } from '@/common/http/middlewares/validate-data-middleware';
import { validateParamsMiddleware } from '@/common/http/middlewares/validate-params-middleware';
import { idParamSchema } from '@/common/schemas/common.schemas';
import { Router } from 'express';
import { setUserDeniedPermissionsDTOSchema, setUserPermissionsDTOSchema } from './schemas/user-access.schemas';
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
userAccessRoutes.post(
    '/deny/:id',
    authMiddleware,
    authorize(['userAccess:manage']),
    validateParamsMiddleware(idParamSchema),
    validateDataMiddleware(setUserDeniedPermissionsDTOSchema),
    userAccessController.deny,
);
