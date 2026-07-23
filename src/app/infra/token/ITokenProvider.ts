export interface ITokenProvider {
    generate(userId: string): string;
}
