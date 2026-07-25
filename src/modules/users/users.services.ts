import { AppError } from '@/app/exceptions/AppError';
import { IHashProvider } from '@/app/infra/hashing/HashProvider';
import { ITokenProvider } from '@/app/infra/token/TokenProvider';
import { env } from '@/env';
import { SafeUser } from '@/modules/users/users.types';
import { IUserRepository } from './users.repository';
import { RegisterUserDTO } from './users.schema';

export class UserService {
    constructor(
        private readonly userRepository: IUserRepository,
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
        const userAlreadyExists = await this.userRepository.findByEmail(data.email);
        if (userAlreadyExists) {
            throw new AppError('Esse e-mail já está vinculado a uma conta cadastrada no sistema.', 409);
        }

        // Extraímos o 'password' e agrupamos o resto das propriedades na variável 'userData'
        const { password: _, ...userData } = data;

        const hashedPassword = await this.hashProvider.hash(data.password);

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
        const decoded = this.tokenProvider.decode(confirmEmailToken) as { sub?: string; purpose?: string } | null;
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

        try {
            this.tokenProvider.verifyEmailConfirmationToken(confirmEmailToken, user.isEmailConfirmed);
        } catch {
            throw new AppError('Token de confirmação inválido ou expirado.', 401);
        }

        await this.userRepository.confirmEmail(user.id);
    }

    async resendConfirmEmail(email: string): Promise<void> {
        const user = await this.userRepository.findByEmail(email, true);
        if (!user) {
            // 🛡️ Mitigação de Timing Attack:
            // Se o e-mail não existe, o fluxo passaria rápido demais (apenas o SELECT no banco).
            // Executamos um hash dummy para nivelar o tempo de processamento com o cenário em que o usuário existe,
            // impedindo que um atacante descubra e-mails cadastrados medindo a latência da resposta.
            const DUMMY_HASH = '$argon2id$v=19$m=65536,p=4,t=3$ov2rVR+AcpuDLmUn6skwHg$trsz7jJNUnKjVWSAz862t7wITvZH7c';
            await this.hashProvider.hash(DUMMY_HASH);
            return;
        }

        // 🛡️ Se o e-mail já foi confirmado, não há o que reenviar (retorna sucesso silencioso)
        if (user.isEmailConfirmed) {
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
