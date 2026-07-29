export class AppError extends Error {
    public readonly statusCode: number;

    constructor(message: string, statusCode = 400) {
        super(message);
        this.statusCode = statusCode;

        // Boa prática: renomear o erro para facilitar a leitura no console
        this.name = 'AppError';
    }
}
