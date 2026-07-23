import argon2 from 'argon2';
import { IHashProvider } from './IHashProvider';

export class Argon2HashProvider implements IHashProvider {
    hash(plainText: string): Promise<string> {
        return argon2.hash(plainText);
    }

    compare(plainText: string, hashedValue: string): Promise<boolean> {
        return argon2.verify(hashedValue, plainText);
    }
}
