// Aqui estamos falando para o typescript que todas as
// requisições agora conterão um objeto usuário que terá um parâmetro id, ou seja,
// estamos expandindo as tipagens padrão do express
declare namespace Express {
    export interface Request {
        user: {
            id: string;
        };
    }
}
