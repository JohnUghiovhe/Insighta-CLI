import { beforeEach, describe, expect, it, vi } from "vitest";
import { InsightaApi } from "./api";
import type { User } from "./types";

const {
  mockClient,
  mockReadCredentials,
  mockSaveCredentials,
  mockClearCredentials
} = vi.hoisted(() => ({
  mockClient: {
    post: vi.fn(),
    request: vi.fn(),
    get: vi.fn()
  },
  mockReadCredentials: vi.fn(),
  mockSaveCredentials: vi.fn(),
  mockClearCredentials: vi.fn()
}));

vi.mock("axios", () => ({
  default: {
    create: vi.fn(() => mockClient),
    isAxiosError: (error: unknown) => typeof error === "object" && error !== null && "response" in (error as object)
  },
  isAxiosError: (error: unknown) => typeof error === "object" && error !== null && "response" in (error as object)
}));

vi.mock("./storage", () => ({
  readCredentials: mockReadCredentials,
  saveCredentials: mockSaveCredentials,
  clearCredentials: mockClearCredentials
}));

const user: User = {
  id: "u1",
  github_id: "g1",
  username: "john",
  email: "john@example.com",
  avatar_url: null,
  role: "analyst",
  is_active: true,
  last_login_at: "2026-01-01T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z"
};

describe("InsightaApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when whoami is requested without credentials", () => {
    const api = new InsightaApi();
    expect(() => api.getWhoAmI()).toThrow("You are not logged in. Run: insighta login");
  });

  it("refreshes expired token and fetches live whoami user", async () => {
    const api = new InsightaApi();

    mockReadCredentials.mockResolvedValue({
      base_url: "http://localhost:3021",
      access_token: "expired-access",
      refresh_token: "refresh-1",
      access_token_expires_at: "2020-01-01T00:00:00.000Z",
      refresh_token_expires_at: "3020-01-01T00:00:00.000Z",
      user
    });

    mockClient.post.mockResolvedValue({
      data: {
        status: "success",
        access_token: "new-access",
        refresh_token: "new-refresh",
        access_token_expires_in_seconds: 180,
        refresh_token_expires_in_seconds: 300
      }
    });

    const liveUser = { ...user, role: "admin" as const };
    mockClient.request.mockResolvedValue({
      data: {
        status: "success",
        data: liveUser
      }
    });

    await api.loadCredentials();
    const result = await api.fetchWhoAmI();

    expect(mockClient.post).toHaveBeenCalledWith("/auth/refresh", { refresh_token: "refresh-1" });
    expect(mockClient.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "GET",
        url: "/auth/me",
        headers: expect.objectContaining({
          Authorization: "Bearer new-access",
          "X-API-Version": "1"
        })
      })
    );
    expect(mockSaveCredentials).toHaveBeenCalled();
    expect(result.role).toBe("admin");
  });

  it("reports session expiry when refresh token is expired", async () => {
    const api = new InsightaApi();

    mockReadCredentials.mockResolvedValue({
      base_url: "http://localhost:3021",
      access_token: "expired-access",
      refresh_token: "expired-refresh",
      access_token_expires_at: "2020-01-01T00:00:00.000Z",
      refresh_token_expires_at: "2020-01-01T00:00:00.000Z",
      user
    });

    await api.loadCredentials();

    await expect(api.listProfiles(new URLSearchParams())).rejects.toThrow("Session expired. Please run: insighta login");
  });

  it("clears credentials on logout", async () => {
    const api = new InsightaApi();

    mockReadCredentials.mockResolvedValue({
      base_url: "http://localhost:3021",
      access_token: "access",
      refresh_token: "refresh",
      access_token_expires_at: "3020-01-01T00:00:00.000Z",
      refresh_token_expires_at: "3020-01-01T00:00:00.000Z",
      user
    });

    mockClient.post.mockResolvedValue({ data: { status: "success" } });

    await api.loadCredentials();
    await api.logout();

    expect(mockClearCredentials).toHaveBeenCalledTimes(1);
  });
});
