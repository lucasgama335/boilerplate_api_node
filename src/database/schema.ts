import { boolean, inet, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

// Tabela de Usuários
export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),

    // Dados Pessoais
    firstName: varchar('first_name', { length: 100 }).notNull(),
    lastName: varchar('last_name', { length: 100 }).notNull(),

    // Credenciais
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),

    // Segurança Adicional Planejada (LGPD / Auth)
    isEmailConfirmed: boolean('is_email_confirmed').default(false).notNull(),
    totpSecret: varchar('totp_secret', { length: 255 }), // Nulo se 2FA desativado
    isTwoFactorEnabled: boolean('is_two_factor_enabled').default(false).notNull(),
    tokensRevokedAt: timestamp('tokens_revoked_at'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Tabela de Tokens de Atualização (Sessões)
export const refreshTokens = pgTable('refresh_tokens', {
    id: uuid('id').defaultRandom().primaryKey(),
    hashedToken: varchar('hashed_token', { length: 255 }).notNull().unique(),

    // Relacionamento com a tabela users
    userId: uuid('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }), // Cascade garante estabilidade dos dados

    // Controle de Rotação e Validade
    expiresAt: timestamp('expires_at').notNull(),
    revoked: boolean('revoked').default(false).notNull(),

    // Identificação
    ipAddress: inet('ip_address').notNull(),
    city: text('city'),
    region: text('region'),
    country: text('country'),
    browser: text('browser'),
    os: text('os'),
    deviceType: text('device_type'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const loginAttemptsStatus = pgEnum('login_attempt_status', ['success', 'fail']);
export const loginAttempts = pgTable('login_attempts', {
    id: uuid('id').defaultRandom().primaryKey(),
    status: loginAttemptsStatus('status').notNull(),
    ipAddress: inet('ip_address').notNull(),

    // Identificação do alvo da tentativa
    email: varchar('email', { length: 255 }), // Opcional, guarda o e-mail digitado
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }), // Relacionamento opciona
    city: text('city'),
    region: text('region'),
    country: text('country'),
    browser: text('browser'),
    os: text('os'),
    deviceType: text('device_type'),

    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
