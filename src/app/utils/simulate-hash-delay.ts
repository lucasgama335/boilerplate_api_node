import { IHashProvider } from '@/app/infra/hashing/HashProvider';

const DUMMY_HASH = '$argon2id$v=19$m=65536,p=4,t=3$ov2rVR+AcpuDLmUn6skwHg$trsz7jJNUnKjVWSAz862t7wFWgcT1Z19LgXgITvZH7c';

// Roda um hash argon2 descartável só para gastar CPU. Precisa ser chamado
// INCONDICIONALMENTE (usuário existindo ou não), nunca só no ramo "não existe" —
// esse era o bug: o ramo "existe" normalmente não faz nenhum hash (só assina um JWT,
// ~100x mais rápido que um argon2.hash), então só equalizar o ramo falso não fecha
// a diferença de tempo, ela só troca de sinal.
export async function simulateHashDelay(hashProvider: IHashProvider): Promise<void> {
    await hashProvider.hash(DUMMY_HASH);
}
