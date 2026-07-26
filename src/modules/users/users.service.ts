import { AppError } from '@/app/exceptions/AppError';
import { IHashProvider } from '@/app/infra/hashing/HashProvider';
import { ITokenProvider } from '@/app/infra/token/TokenProvider';
import { simulateHashDelay } from '@/app/utils/simulate-hash-delay';
import { env } from '@/env';
import { SafeUser } from '@/modules/users/types/users.types';
import { IUsersRepository } from './repositories/users.repository';
import { RegisterUserDTO } from './schemas/users.schemas';

export class UserService {
    constructor(
        private readonly userRepository: IUsersRepository,
        private readonly hashProvider: IHashProvider,
        private readonly tokenProvider: ITokenProvider,
    ) {}

    async getProfile(userId: string): Promise<SafeUser> {
        const user = await this.userRepository.findById(userId);
        if (!user) {
            throw new AppError('Usuário não encontrado', 404);
        }
        return user;
    }

    async registerUser(data: RegisterUserDTO): Promise<SafeUser> {
        // 🛡️ CORREÇÃO DE SEGURANÇA (Anti-Timing Attack):
        // Executamos o hash da senha ANTES de ir ao banco de dados.
        // Isso "paga o pedágio" da lentidão do Argon2 de forma incondicional,
        // mascarando para o atacante se o e-mail já existe ou não.

        const hashedPassword = await this.hashProvider.hash(data.password);

        const userAlreadyExists = await this.userRepository.findByEmail(data.email);
        if (userAlreadyExists) {
            throw new AppError('Esse e-mail já está vinculado a uma conta cadastrada no sistema.', 409);
        }

        // Extraímos o 'password' e agrupamos o resto das propriedades na variável 'userData'
        const { password: _, ...userData } = data;

        const createdUser = await this.userRepository.create({
            ...userData,
            passwordHash: hashedPassword,
        });

        // Gera o token stateless de confirmação
        const confirmationToken = this.tokenProvider.generateEmailConfirmationToken(createdUser.id, false);

        if (env.NODE_ENV === 'development') {
            console.log(`📧 [EMAIL CONFIRMATION - TOKEN]: ${confirmationToken}`);
        }
        // TODO: Enviar por e-mail via EmailProvider

        return createdUser;
    }

    async confirmEmail(confirmEmailToken: string): Promise<void> {
        // 1. Decodifica levemente apenas para checar o purpose ou extrair o ID com segurança após o verify
        let decoded: { sub?: string; purpose?: string };
        try {
            decoded = this.tokenProvider.decode(confirmEmailToken);
        } catch {
            throw new AppError('Token de confirmação de e-mail inválido.', 400);
        }

        if (!decoded || !decoded.sub || decoded.purpose !== 'email-confirmation') {
            throw new AppError('Token de confirmação de e-mail inválido.', 400);
        }

        const user = await this.userRepository.findById(decoded.sub, true);
        if (!user) {
            throw new AppError('Usuário não encontrado.', 404);
        }

        if (user.isEmailConfirmed) {
            throw new AppError('Este e-mail já foi confirmado anteriormente.', 400);
        }

        // 2. Valida assinatura e expiração de forma segura usando o segredo dinâmico do banco
        try {
            this.tokenProvider.verifyEmailConfirmationToken(confirmEmailToken, user.isEmailConfirmed);
        } catch {
            throw new AppError('Token de confirmação inválido ou expirado.', 401);
        }

        await this.userRepository.confirmEmail(user.id);
    }

    async resendConfirmEmail(email: string): Promise<void> {
        const user = await this.userRepository.findByEmail(email, true);

        // Mesmo raciocínio do createResetPassword: paga o custo do hash sempre.
        await simulateHashDelay(this.hashProvider);

        if (!user || user.isEmailConfirmed) {
            // 🛡️ Se não existe OU já foi confirmado, retorna sucesso silencioso —
            // não dá pra diferenciar os dois casos de fora.
            return;
        }

        const { id, isEmailConfirmed } = user;
        const resendedEmail = this.tokenProvider.generateEmailConfirmationToken(id, isEmailConfirmed);
        if (env.NODE_ENV === 'development') {
            console.log(`🛡️ [RESEND CONFIRM EMAIL - TOKEN]: ${resendedEmail}`);
        }
        // TODO: Chamar futuro Provedor de E-mail (ex: emailProvider.send(...))
    }
}
