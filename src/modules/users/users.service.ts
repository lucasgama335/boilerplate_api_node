import { AppError } from '@/common/exceptions/AppError';
import { IHashProvider } from '@/common/infra/providers/hash.provider';
import { ITokenProvider } from '@/common/infra/providers/token.provider';
import { simulateHashDelay } from '@/common/utils/simulate-hash-delay';
import { env } from '@/env';
import { SafeUser, toSafeUser } from '@/modules/users/types/users.types';
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
            throw new AppError('Usuário não encontrado.', 404);
        }

        const safeUser = toSafeUser(user);
        return { ...safeUser };
    }

    async registerUser(data: RegisterUserDTO): Promise<SafeUser> {
        const { password: rawPassword, ...userData } = data;

        const userAlreadyExists = await this.userRepository.findByEmail(data.email);
        if (userAlreadyExists) {
            throw new AppError('Esse e-mail já está vinculado a uma conta cadastrada no sistema.', 409);
        }

        if (data.departments && data.departments.length > 0) {
            const departmentsExists = await this.userRepository.checkDepartmentsExist(data.departments);
            if (!departmentsExists) {
                throw new AppError('Um ou mais IDs de departamentos informados são inválidos ou não existem.', 400);
            }
        }

        const hashedPassword = await this.hashProvider.hash(rawPassword); // 🛡️ Segurança contra time attacking

        // Registra o usuário no banco e gera o token de confirmação de e-mail
        const createdUser = await this.userRepository.create({
            ...userData,
            passwordHash: hashedPassword,
        });

        const confirmationToken = this.tokenProvider.generateEmailConfirmationToken(createdUser.id, false);
        if (env.NODE_ENV === 'development') {
            console.log(`📧 [EMAIL CONFIRMATION - TOKEN]: ${confirmationToken}`);
        }
        // TODO: Enviar por e-mail via EmailProvider

        return { ...toSafeUser(createdUser) };
    }

    async confirmEmail(confirmEmailToken: string): Promise<void> {
        // Decodifica levemente apenas para checar o purpose ou extrair o ID com segurança após o verify
        let decoded: { sub?: string; purpose?: string };
        try {
            decoded = this.tokenProvider.decode(confirmEmailToken);
        } catch {
            throw new AppError('Token de confirmação de e-mail inválido.', 400);
        }

        if (!decoded || !decoded.sub || decoded.purpose !== 'email-confirmation') {
            throw new AppError('Token de confirmação de e-mail inválido.', 400);
        }

        const user = await this.userRepository.findById(decoded.sub);
        if (!user) {
            throw new AppError('Usuário não encontrado.', 404);
        }

        if (user.isEmailConfirmed) {
            throw new AppError('Este e-mail já foi confirmado anteriormente.', 400);
        }

        // Valida assinatura e expiração de forma segura usando o segredo dinâmico do banco
        try {
            this.tokenProvider.verifyEmailConfirmationToken(confirmEmailToken, user.isEmailConfirmed);
        } catch {
            throw new AppError('Token de confirmação inválido ou expirado.', 401);
        }

        await this.userRepository.confirmEmail(user.id);
    }

    async resendConfirmEmail(email: string): Promise<void> {
        const user = await this.userRepository.findByEmail(email);

        await simulateHashDelay(this.hashProvider); // 🛡️ Segurança contra time attacking

        if (!user || user.isEmailConfirmed) {
            // 🛡️ Se não existe OU já foi confirmado, retorna sucesso silencioso —
            // não dá pra diferenciar os dois casos de fora.
            return;
        }

        const resendedEmail = this.tokenProvider.generateEmailConfirmationToken(user.id, user.isEmailConfirmed);
        if (env.NODE_ENV === 'development') {
            console.log(`🛡️ [RESEND CONFIRM EMAIL - TOKEN]: ${resendedEmail}`);
        }
        // TODO: Chamar futuro Provedor de E-mail (ex: emailProvider.send(...))
    }
}
