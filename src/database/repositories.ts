import { LoginAttemptsRepository } from '@/modules/authentication/repositories/login-attempts.repository';
import { DrizzleRefreshsTokenRepository } from '@/modules/authentication/repositories/refresh-tokens.repository';
import { DrizzleDepartmentPermissionsRepository } from '@/modules/departments/repositories/department-permissions.repository';
import { DrizzleDepartmentsRepository } from '@/modules/departments/repositories/departments.repository';
import { DrizzleUserDepartmentsRepository } from '@/modules/departments/repositories/user-departments.repository';
import { DrizzlePermissionsRepository } from '@/modules/permissions/repositories/permissions.repository';
import { DrizzleUserPermissionsRepository } from '@/modules/users/repositories/user-permissions.repository';
import { DrizzleUsersRepository } from '@/modules/users/repositories/users.repository';
import { databaseInstance } from './index';

// Instanciamos todos os repositórios em um lugar neutro e sem dependências externas
export const userRepository = new DrizzleUsersRepository(databaseInstance);
export const refreshTokenRepository = new DrizzleRefreshsTokenRepository(databaseInstance);
export const loginAttemptRepository = new LoginAttemptsRepository(databaseInstance);
export const permissionsRepository = new DrizzlePermissionsRepository(databaseInstance);
export const departmentsRepository = new DrizzleDepartmentsRepository(databaseInstance);
export const userPermissionsRepository = new DrizzleUserPermissionsRepository(databaseInstance);
export const departmentPermissionsRepository = new DrizzleDepartmentPermissionsRepository(databaseInstance);
export const userDepartmentsRepository = new DrizzleUserDepartmentsRepository(databaseInstance);
