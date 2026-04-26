import { beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";

const memory = new Map<string, string>();

vi.mock("node:os", () => ({
  default: {
    homedir: () => "/mock-home"
  }
}));

vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(async () => undefined),
  readFile: vi.fn(async (filePath: string) => {
    if (!memory.has(filePath)) {
      const error = Object.assign(new Error("not found"), { code: "ENOENT" });
      throw error;
    }
    return memory.get(filePath);
  }),
  writeFile: vi.fn(async (filePath: string, content: string) => {
    memory.set(filePath, content);
  }),
  rm: vi.fn(async (filePath: string) => {
    memory.delete(filePath);
  })
}));

describe("storage", () => {
  beforeEach(() => {
    memory.clear();
  });

  it("saves and reads credentials from ~/.insighta/credentials.json", async () => {
    const storage = await import("./storage");

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
    expect(storage.getCredentialsPath()).toBe(path.join("/mock-home", ".insighta", "credentials.json"));
    expect(data?.user.username).toBe("john");
  });

  it("clears saved credentials", async () => {
    const storage = await import("./storage");

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
    expect(await storage.readCredentials()).toBeNull();
  });
});
