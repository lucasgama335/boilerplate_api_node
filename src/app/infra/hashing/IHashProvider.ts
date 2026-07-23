export interface IHashProvider {
    hash(plainText: string): Promise<string>;
    compare(plainText: string, hashedValue: string): Promise<boolean>;
}
