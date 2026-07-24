export interface ITokenProvider {
    generate(userId: string): string;
    verify(token: string, secret: string): { sub: string };
}
