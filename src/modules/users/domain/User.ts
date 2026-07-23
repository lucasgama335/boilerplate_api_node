// 1. A Entidade Segura (O padrão que trafega no sistema e vai para o Front)
export type User = {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    createdAt: Date;
    updatedAt: Date;
};

// 2. O Tipo para Autenticação (Usado estritamente no Login)
export type UserWithPassword = User & {
    passwordHash: string;
};

// 3. O Tipo para Inserção (O que o Repositório exige para salvar)
export type CreateUserData = {
    firstName: string;
    lastName: string;
    email: string;
    passwordHash: string;
};
