"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const node_path_1 = __importDefault(require("node:path"));
const memory = new Map();
vitest_1.vi.mock("node:os", () => ({
    default: {
        homedir: () => "/mock-home"
    }
}));
vitest_1.vi.mock("node:fs/promises", () => ({
    mkdir: vitest_1.vi.fn(async () => undefined),
    readFile: vitest_1.vi.fn(async (filePath) => {
        if (!memory.has(filePath)) {
            const error = Object.assign(new Error("not found"), { code: "ENOENT" });
            throw error;
        }
        return memory.get(filePath);
    }),
    writeFile: vitest_1.vi.fn(async (filePath, content) => {
        memory.set(filePath, content);
    }),
    rm: vitest_1.vi.fn(async (filePath) => {
        memory.delete(filePath);
    })
}));
(0, vitest_1.describe)("storage", () => {
    (0, vitest_1.beforeEach)(() => {
        memory.clear();
    });
    (0, vitest_1.it)("saves and reads credentials from ~/.insighta/credentials.json", async () => {
        const storage = await import("./storage.js");
        await storage.saveCredentials({
            base_url: "http://localhost:3021",
            access_token: "a",
            refresh_token: "r",
            access_token_expires_at: "2026-01-01T00:00:00.000Z",
            refresh_token_expires_at: "2026-01-01T00:05:00.000Z",
            user: {
                id: "1",
                github_id: "gh",
                username: "john",
                email: null,
                avatar_url: null,
                role: "analyst",
                is_active: true,
                last_login_at: "2026-01-01T00:00:00.000Z",
                created_at: "2026-01-01T00:00:00.000Z"
            }
        });
        const data = await storage.readCredentials();
        (0, vitest_1.expect)(storage.getCredentialsPath()).toBe(node_path_1.default.join("/mock-home", ".insighta", "credentials.json"));
        (0, vitest_1.expect)(data?.user.username).toBe("john");
    });
    (0, vitest_1.it)("clears saved credentials", async () => {
        const storage = await import("./storage.js");
        await storage.saveCredentials({
            base_url: "http://localhost:3021",
            access_token: "a",
            refresh_token: "r",
            access_token_expires_at: "2026-01-01T00:00:00.000Z",
            refresh_token_expires_at: "2026-01-01T00:05:00.000Z",
            user: {
                id: "1",
                github_id: "gh",
                username: "john",
                email: null,
                avatar_url: null,
                role: "analyst",
                is_active: true,
                last_login_at: "2026-01-01T00:00:00.000Z",
                created_at: "2026-01-01T00:00:00.000Z"
            }
        });
        await storage.clearCredentials();
        (0, vitest_1.expect)(await storage.readCredentials()).toBeNull();
    });
});
