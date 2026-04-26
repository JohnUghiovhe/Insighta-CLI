"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
        const storage = await Promise.resolve().then(() => __importStar(require("./storage")));
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
        const storage = await Promise.resolve().then(() => __importStar(require("./storage")));
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
