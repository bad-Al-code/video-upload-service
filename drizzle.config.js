"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const drizzle_kit_1 = require("drizzle-kit");
if (!process.env.DB_USER ||
    !process.env.DB_PASSWORD ||
    !process.env.DB_HOST ||
    !process.env.DB_PORT ||
    !process.env.DB_NAME) {
    throw new Error('Missing required database environment variables (DB_USER, DB_PASSWORD, DB_HOST, DB_PORT, DB_NAME)');
}
const databaseUrl = `mysql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`;
console.log('Using Database URL for Drizzle Kit:', databaseUrl);
exports.default = (0, drizzle_kit_1.defineConfig)({
    out: './drizzle',
    schema: './src/db/schema.ts',
    dialect: 'mysql',
    dbCredentials: {
        url: databaseUrl,
    },
    verbose: true,
    strict: true,
});
