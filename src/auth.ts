import { createServer } from "node:http";
import crypto from "node:crypto";
import axios from "axios";
import open from "open";
import { withSpinner } from "./ui";

interface LoginFlowOptions {
  baseUrl: string;
  callbackPort: number;
}

interface LoginResult {
  status: "success";
  access_token: string;
  refresh_token: string;
  access_token_expires_in_seconds: number;
  refresh_token_expires_in_seconds: number;
  data: {
    id: string;
    github_id: string;
    username: string;
    email: string | null;
    avatar_url: string | null;
    role: "admin" | "analyst";
    is_active: boolean;
    last_login_at: string;
    created_at: string;
  };
}

const sha256Base64Url = (value: string): string =>
  crypto.createHash("sha256").update(value).digest("base64url");

const randomToken = (): string => crypto.randomBytes(32).toString("base64url");

export const runLoginFlow = async ({ baseUrl, callbackPort }: LoginFlowOptions): Promise<LoginResult> => {
  const state = randomToken();
  const codeVerifier = randomToken();
  const codeChallenge = sha256Base64Url(codeVerifier);
  const callbackUrl = `http://127.0.0.1:${callbackPort}/callback`;

  return withSpinner("Starting OAuth login flow...", async () => {
    const codeAndStatePromise = new Promise<{ code: string; state: string }>((resolve, reject) => {
      const server = createServer((req, res) => {
        const url = new URL(req.url ?? "/", callbackUrl);
        if (url.pathname !== "/callback") {
          res.writeHead(404).end("Not found");
          return;
        }

        const returnedCode = url.searchParams.get("code");
        const returnedState = url.searchParams.get("state");
        if (!returnedCode || !returnedState) {
          res.writeHead(400).end("Invalid callback");
          reject(new Error("Invalid callback payload"));
          server.close();
          return;
        }

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h2>Insighta login complete. You can close this tab.</h2>");
        resolve({ code: returnedCode, state: returnedState });
        server.close();
      });

      server.listen(callbackPort, "127.0.0.1");
      setTimeout(() => {
        reject(new Error("Login timeout. Please try again."));
        server.close();
      }, 120000);
    });

    const initResponse = await axios.get<{ status: "success"; client_id: string; scope: string }>(`${baseUrl}/auth/github/init`);
    const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
    authorizeUrl.searchParams.set("client_id", initResponse.data.client_id);
    authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
    authorizeUrl.searchParams.set("scope", initResponse.data.scope);
    authorizeUrl.searchParams.set("state", state);
    authorizeUrl.searchParams.set("code_challenge", codeChallenge);
    authorizeUrl.searchParams.set("code_challenge_method", "S256");

    await open(authorizeUrl.toString());

    const callbackPayload = await codeAndStatePromise;
    if (callbackPayload.state !== state) {
      throw new Error("State mismatch. Login aborted.");
    }

    const tokenResponse = await axios.post<LoginResult>(`${baseUrl}/auth/github/exchange`, {
      code: callbackPayload.code,
      code_verifier: codeVerifier,
      redirect_uri: callbackUrl
    });

    return tokenResponse.data;
  });
};
