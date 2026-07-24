import argon2 from 'argon2';

export interface IHashProvider {
    hash(plainText: string): Promise<string>;
    compare(plainText: string, hashedValue: string): Promise<boolean>;
}

export class HashProvider implements IHashProvider {
    hash(plainText: string): Promise<string> {
        return argon2.hash(plainText);
    }

    compare(plainText: string, hashedValue: string): Promise<boolean> {
        return argon2.verify(hashedValue, plainText);
    }
}
