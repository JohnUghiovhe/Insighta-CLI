"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const api_1 = require("./api");
const { mockClient, mockReadCredentials, mockSaveCredentials, mockClearCredentials } = vitest_1.vi.hoisted(() => ({
    mockClient: {
        post: vitest_1.vi.fn(),
        request: vitest_1.vi.fn(),
        get: vitest_1.vi.fn()
    },
    mockReadCredentials: vitest_1.vi.fn(),
    mockSaveCredentials: vitest_1.vi.fn(),
    mockClearCredentials: vitest_1.vi.fn()
}));
vitest_1.vi.mock("axios", () => ({
    default: {
        create: vitest_1.vi.fn(() => mockClient),
        isAxiosError: (error) => typeof error === "object" && error !== null && "response" in error
    },
    isAxiosError: (error) => typeof error === "object" && error !== null && "response" in error
}));
vitest_1.vi.mock("./storage", () => ({
    readCredentials: mockReadCredentials,
    saveCredentials: mockSaveCredentials,
    clearCredentials: mockClearCredentials
}));
const user = {
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
(0, vitest_1.describe)("InsightaApi", () => {
    (0, vitest_1.beforeEach)(() => {
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)("throws when whoami is requested without credentials", () => {
        const api = new api_1.InsightaApi();
        (0, vitest_1.expect)(() => api.getWhoAmI()).toThrow("You are not logged in. Run: insighta login");
    });
    (0, vitest_1.it)("refreshes expired token and fetches live whoami user", async () => {
        const api = new api_1.InsightaApi();
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
        const liveUser = { ...user, role: "admin" };
        mockClient.request.mockResolvedValue({
            data: {
                status: "success",
                data: liveUser
            }
        });
        await api.loadCredentials();
        const result = await api.fetchWhoAmI();
        (0, vitest_1.expect)(mockClient.post).toHaveBeenCalledWith("/auth/refresh", { refresh_token: "refresh-1" });
        (0, vitest_1.expect)(mockClient.request).toHaveBeenCalledWith(vitest_1.expect.objectContaining({
            method: "GET",
            url: "/auth/me",
            headers: vitest_1.expect.objectContaining({
                Authorization: "Bearer new-access",
                "X-API-Version": "1"
            })
        }));
        (0, vitest_1.expect)(mockSaveCredentials).toHaveBeenCalled();
        (0, vitest_1.expect)(result.role).toBe("admin");
    });
    (0, vitest_1.it)("reports session expiry when refresh token is expired", async () => {
        const api = new api_1.InsightaApi();
        mockReadCredentials.mockResolvedValue({
            base_url: "http://localhost:3021",
            access_token: "expired-access",
            refresh_token: "expired-refresh",
            access_token_expires_at: "2020-01-01T00:00:00.000Z",
            refresh_token_expires_at: "2020-01-01T00:00:00.000Z",
            user
        });
        await api.loadCredentials();
        await (0, vitest_1.expect)(api.listProfiles(new URLSearchParams())).rejects.toThrow("Session expired. Please run: insighta login");
    });
    (0, vitest_1.it)("clears credentials on logout", async () => {
        const api = new api_1.InsightaApi();
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
        (0, vitest_1.expect)(mockClearCredentials).toHaveBeenCalledTimes(1);
    });
});
