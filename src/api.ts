import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from "axios";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { clearCredentials, readCredentials, saveCredentials } from "./storage";
import { Credentials, ListResponse, Profile, SingleProfileResponse, User } from "./types";

interface RefreshResponse {
  status: "success";
  access_token: string;
  refresh_token: string;
  access_token_expires_in_seconds: number;
  refresh_token_expires_in_seconds: number;
}

interface LoginCallbackResponse extends RefreshResponse {
  data: User;
}

const API_VERSION = "1";

const expiryDateFromNow = (seconds: number): string => new Date(Date.now() + seconds * 1000).toISOString();

const buildClient = (baseUrl: string): AxiosInstance =>
  axios.create({
    baseURL: baseUrl,
    timeout: 15000
  });

const extractErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const apiMessage = (error.response?.data as { error?: string } | undefined)?.error;
    return apiMessage ?? error.message;
  }
  return error instanceof Error ? error.message : "Unknown error";
};

export class InsightaApi {
  private credentials: Credentials | null = null;

  private get client(): AxiosInstance {
    if (!this.credentials) {
      throw new Error("You are not logged in. Run: insighta login");
    }
    return buildClient(this.credentials.base_url);
  }

  async loadCredentials(): Promise<void> {
    this.credentials = await readCredentials();
  }

  async loginWithCallbackPayload(baseUrl: string, payload: LoginCallbackResponse): Promise<void> {
    this.credentials = {
      base_url: baseUrl,
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
      access_token_expires_at: expiryDateFromNow(payload.access_token_expires_in_seconds),
      refresh_token_expires_at: expiryDateFromNow(payload.refresh_token_expires_in_seconds),
      user: payload.data
    };
    await saveCredentials(this.credentials);
  }

  async logout(): Promise<void> {
    if (!this.credentials) {
      await clearCredentials();
      return;
    }
    try {
      await this.client.post("/auth/logout", { refresh_token: this.credentials.refresh_token });
    } finally {
      this.credentials = null;
      await clearCredentials();
    }
  }

  getWhoAmI(): User {
    if (!this.credentials) {
      throw new Error("You are not logged in. Run: insighta login");
    }
    return this.credentials.user;
  }

  private async refreshIfNeeded(): Promise<void> {
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
      const response = await this.client.post<RefreshResponse>("/auth/refresh", {
        refresh_token: this.credentials.refresh_token
      });
      this.credentials = {
        ...this.credentials,
        access_token: response.data.access_token,
        refresh_token: response.data.refresh_token,
        access_token_expires_at: expiryDateFromNow(response.data.access_token_expires_in_seconds),
        refresh_token_expires_at: expiryDateFromNow(response.data.refresh_token_expires_in_seconds)
      };
      await saveCredentials(this.credentials);
    } catch {
      throw new Error("Session refresh failed. Please run: insighta login");
    }
  }

  private async authedRequest<T>(config: AxiosRequestConfig): Promise<T> {
    await this.refreshIfNeeded();
    if (!this.credentials) {
      throw new Error("You are not logged in. Run: insighta login");
    }

    try {
      const response = await this.client.request<T>({
        ...config,
        headers: {
          ...(config.headers ?? {}),
          Authorization: `Bearer ${this.credentials.access_token}`,
          "X-API-Version": API_VERSION
        }
      });
      return response.data;
    } catch (error) {
      const axiosError = error as AxiosError;
      if (axiosError.response?.status === 401) {
        throw new Error("Unauthorized. Please run: insighta login");
      }
      throw new Error(extractErrorMessage(error));
    }
  }

  async listProfiles(query: URLSearchParams): Promise<ListResponse> {
    return this.authedRequest<ListResponse>({ method: "GET", url: `/api/profiles?${query.toString()}` });
  }

  async getProfile(id: string): Promise<Profile> {
    const data = await this.authedRequest<SingleProfileResponse>({ method: "GET", url: `/api/profiles/${id}` });
    return data.data;
  }

  async searchProfiles(text: string): Promise<ListResponse> {
    const query = new URLSearchParams({ q: text });
    return this.authedRequest<ListResponse>({ method: "GET", url: `/api/profiles/search?${query.toString()}` });
  }

  async createProfile(name: string): Promise<Profile> {
    const data = await this.authedRequest<SingleProfileResponse>({
      method: "POST",
      url: "/api/profiles",
      data: { name }
    });
    return data.data;
  }

  async exportProfiles(format: "csv", query: URLSearchParams): Promise<string> {
    const params = new URLSearchParams(query);
    params.set("format", format);

    await this.refreshIfNeeded();
    if (!this.credentials) {
      throw new Error("You are not logged in. Run: insighta login");
    }

    try {
      const response = await this.client.get<string>(`/api/profiles/export?${params.toString()}`, {
        responseType: "text",
        headers: {
          Authorization: `Bearer ${this.credentials.access_token}`,
          "X-API-Version": API_VERSION
        }
      });

      const filename = `profiles_${new Date().toISOString().replace(/[:.]/g, "-")}.csv`;
      const targetPath = path.resolve(process.cwd(), filename);
      await writeFile(targetPath, response.data, "utf8");
      return targetPath;
    } catch (error) {
      throw new Error(extractErrorMessage(error));
    }
  }
}
