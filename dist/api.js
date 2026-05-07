"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.InsightaApi = void 0;
const axios_1 = __importDefault(require("axios"));
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const storage_1 = require("./storage");
const API_VERSION = "1";
const expiryDateFromNow = (seconds) => new Date(Date.now() + seconds * 1000).toISOString();
const buildClient = (baseUrl) => axios_1.default.create({
    baseURL: baseUrl,
    timeout: 15000
});
const extractErrorMessage = (error) => {
    if (axios_1.default.isAxiosError(error)) {
        const apiMessage = error.response?.data?.error;
        return apiMessage ?? error.message;
    }
    return error instanceof Error ? error.message : "Unknown error";
};
class InsightaApi {
    credentials = null;
    get client() {
        if (!this.credentials) {
            throw new Error("You are not logged in. Run: insighta login");
        }
        return buildClient(this.credentials.base_url);
    }
    async loadCredentials() {
        this.credentials = await (0, storage_1.readCredentials)();
    }
    async loginWithCallbackPayload(baseUrl, payload) {
        this.credentials = {
            base_url: baseUrl,
            access_token: payload.access_token,
            refresh_token: payload.refresh_token,
            access_token_expires_at: expiryDateFromNow(payload.access_token_expires_in_seconds),
            refresh_token_expires_at: expiryDateFromNow(payload.refresh_token_expires_in_seconds),
            user: payload.data
        };
        await (0, storage_1.saveCredentials)(this.credentials);
    }
    async logout() {
        if (!this.credentials) {
            await (0, storage_1.clearCredentials)();
            return;
        }
        try {
            await this.client.post("/auth/logout", { refresh_token: this.credentials.refresh_token });
        }
        finally {
            this.credentials = null;
            await (0, storage_1.clearCredentials)();
        }
    }
    getWhoAmI() {
        if (!this.credentials) {
            throw new Error("You are not logged in. Run: insighta login");
        }
        return this.credentials.user;
    }
    async fetchWhoAmI() {
        const response = await this.authedRequest({ method: "GET", url: "/auth/me" });
        if (!this.credentials) {
            throw new Error("You are not logged in. Run: insighta login");
        }
        this.credentials = {
            ...this.credentials,
            user: response.data
        };
        await (0, storage_1.saveCredentials)(this.credentials);
        return response.data;
    }
    async refreshIfNeeded() {
        if (!this.credentials) {
            throw new Error("You are not logged in. Run: insighta login");
        }
        if (Date.now() < new Date(this.credentials.access_token_expires_at).getTime()) {
            return;
        }
        if (Date.now() >= new Date(this.credentials.refresh_token_expires_at).getTime()) {
            throw new Error("Session expired. Please run: insighta login");
        }
        try {
            const response = await this.client.post("/auth/refresh", {
                refresh_token: this.credentials.refresh_token
            });
            this.credentials = {
                ...this.credentials,
                access_token: response.data.access_token,
                refresh_token: response.data.refresh_token,
                access_token_expires_at: expiryDateFromNow(response.data.access_token_expires_in_seconds),
                refresh_token_expires_at: expiryDateFromNow(response.data.refresh_token_expires_in_seconds)
            };
            await (0, storage_1.saveCredentials)(this.credentials);
        }
        catch {
            throw new Error("Session refresh failed. Please run: insighta login");
        }
    }
    async authedRequest(config) {
        await this.refreshIfNeeded();
        if (!this.credentials) {
            throw new Error("You are not logged in. Run: insighta login");
        }
        try {
            const response = await this.client.request({
                ...config,
                headers: {
                    ...(config.headers ?? {}),
                    Authorization: `Bearer ${this.credentials.access_token}`,
                    "X-API-Version": API_VERSION
                }
            });
            return response.data;
        }
        catch (error) {
            const axiosError = error;
            if (axiosError.response?.status === 401) {
                throw new Error("Unauthorized. Please run: insighta login");
            }
            throw new Error(extractErrorMessage(error));
        }
    }
    async listProfiles(query) {
        return this.authedRequest({ method: "GET", url: `/api/profiles?${query.toString()}` });
    }
    async getProfile(id) {
        const data = await this.authedRequest({ method: "GET", url: `/api/profiles/${id}` });
        return data.data;
    }
    async searchProfiles(text) {
        const query = new URLSearchParams({ q: text });
        return this.authedRequest({ method: "GET", url: `/api/profiles/search?${query.toString()}` });
    }
    async createProfile(name) {
        const data = await this.authedRequest({
            method: "POST",
            url: "/api/profiles",
            data: { name }
        });
        return data.data;
    }
    async exportProfiles(format, query) {
        const params = new URLSearchParams(query);
        params.set("format", format);
        await this.refreshIfNeeded();
        if (!this.credentials) {
            throw new Error("You are not logged in. Run: insighta login");
        }
        try {
            const response = await this.client.get(`/api/profiles/export?${params.toString()}`, {
                responseType: "text",
                headers: {
                    Authorization: `Bearer ${this.credentials.access_token}`,
                    "X-API-Version": API_VERSION
                }
            });
            const filename = `profiles_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
            const targetPath = node_path_1.default.resolve(process.cwd(), filename);
            await (0, promises_1.writeFile)(targetPath, response.data, "utf8");
            return targetPath;
        }
        catch (error) {
            throw new Error(extractErrorMessage(error));
        }
    }
    async uploadProfiles(filePath) {
        await this.refreshIfNeeded();
        if (!this.credentials)
            throw new Error("You are not logged in. Run: insighta login");
        if (!node_fs_1.default.existsSync(filePath))
            throw new Error(`File not found: ${filePath}`);
        const stream = node_fs_1.default.createReadStream(filePath);
        try {
            const headers = {
                "Content-Type": "text/csv",
                Authorization: `Bearer ${this.credentials.access_token}`,
                "X-API-Version": API_VERSION
            };
            const response = await this.client.request({
                method: "POST",
                url: "/api/profiles/upload",
                data: stream,
                headers,
                maxBodyLength: Infinity,
                maxContentLength: Infinity,
                timeout: 0
            });
            return response.data;
        }
        catch (error) {
            throw new Error(extractErrorMessage(error));
        }
    }
}
exports.InsightaApi = InsightaApi;
