import { CreateUserData, User, UserWithPassword } from './User';

export interface IUserRepository {
    // Como o tipo de retorno depende do parâmetro showUserPasswordHash precisamos fazer
    // uma sobrecarga de função para garantir o resultado retornado em cada cenário.
    findByEmail(email: string, showUserPasswordHash: true): Promise<UserWithPassword | null>;
    findByEmail(email: string, showUserPasswordHash?: false): Promise<User | null>;
    findByEmail(email: string, showUserPasswordHash?: boolean): Promise<User | UserWithPassword | null>;

    findById(id: string, showUserPasswordHash: true): Promise<UserWithPassword | null>;
    findById(id: string, showUserPasswordHash?: false): Promise<User | null>;
    findById(id: string, showUserPasswordHash?: boolean): Promise<User | UserWithPassword | null>;

    create(data: CreateUserData): Promise<User>;
}
