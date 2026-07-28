import { env } from '@/env';
import { RegisterUserDTO } from '../../schemas/users.schemas';
import { CreateUserDTO } from '../../types/users.types';

export function makeCreateUser(override: Partial<CreateUserDTO> = {}): CreateUserDTO {
    // Geramos um sufixo único para evitar conflito de e-mails em testes paralelos
    const uniqueId = Math.random().toString(36).substring(2, 9);

    return {
        firstName: 'John',
        lastName: 'Doe',
        email: `john.doe.${uniqueId}@example.com`,
        passwordHash: env.DUMMY_HASH, // Padrão seguro definido no seu .env de teste
        isEmailConfirmed: false,
        ...override, // 👈 A mágica: substitui qualquer campo padrão pelo que você passar
    };
}

export function makeCreateUserDTO(override: Partial<RegisterUserDTO> = {}): RegisterUserDTO {
    // Geramos um sufixo único para evitar conflito de e-mails em testes paralelos
    const uniqueId = Math.random().toString(36).substring(2, 9);

    return {
        firstName: 'John',
        lastName: 'Doe',
        email: `john.doe.${uniqueId}@example.com`,
        password: env.DUMMY_HASH, // Padrão seguro definido no seu .env de teste
        passwordConfirmation: env.DUMMY_HASH, // Padrão seguro definido no seu .env de teste
        departments: [],
        ...override, // 👈 A mágica: substitui qualquer campo padrão pelo que você passar
    };
}
