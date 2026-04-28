"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runLoginFlow = void 0;
const node_http_1 = require("node:http");
const node_crypto_1 = __importDefault(require("node:crypto"));
const axios_1 = __importDefault(require("axios"));
const ui_1 = require("./ui");
const sha256Base64Url = (value) => node_crypto_1.default.createHash("sha256").update(value).digest("base64url");
const randomToken = () => node_crypto_1.default.randomBytes(32).toString("base64url");
const runLoginFlow = async ({ baseUrl, callbackPort }) => {
    const state = randomToken();
    const codeVerifier = randomToken();
    const codeChallenge = sha256Base64Url(codeVerifier);
    const callbackHost = process.env.INSIGHTA_CALLBACK_HOST?.trim() || "localhost";
    const callbackPath = process.env.INSIGHTA_CALLBACK_PATH?.trim() || "/callback";
    const normalizedCallbackPath = callbackPath.startsWith("/") ? callbackPath : `/${callbackPath}`;
    const callbackUrl = `http://${callbackHost}:${callbackPort}${normalizedCallbackPath}`;
    return (0, ui_1.withSpinner)("Starting OAuth login flow...", async () => {
        const codeAndStatePromise = new Promise((resolve, reject) => {
            const server = (0, node_http_1.createServer)((req, res) => {
                const url = new URL(req.url ?? "/", callbackUrl);
                if (url.pathname !== normalizedCallbackPath) {
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
            server.listen(callbackPort, callbackHost);
            setTimeout(() => {
                reject(new Error("Login timeout. Please try again."));
                server.close();
            }, 120000); // 120 seconds timeout
        });
        const initResponse = await axios_1.default.get(`${baseUrl}/auth/github/init`);
        const authorizeUrl = new URL("https://github.com/login/oauth/authorize");
        authorizeUrl.searchParams.set("client_id", initResponse.data.client_id);
        authorizeUrl.searchParams.set("redirect_uri", callbackUrl);
        authorizeUrl.searchParams.set("scope", initResponse.data.scope);
        authorizeUrl.searchParams.set("state", state);
        authorizeUrl.searchParams.set("code_challenge", codeChallenge);
        authorizeUrl.searchParams.set("code_challenge_method", "S256");
        console.log(`OAuth callback URL: ${callbackUrl}`);
        const { default: open } = await import("open");
        await open(authorizeUrl.toString());
        const callbackPayload = await codeAndStatePromise;
        if (callbackPayload.state !== state) {
            throw new Error("State mismatch. Login aborted.");
        }
        const tokenResponse = await axios_1.default.post(`${baseUrl}/auth/github/exchange`, {
            code: callbackPayload.code,
            code_verifier: codeVerifier,
            redirect_uri: callbackUrl
        });
        return tokenResponse.data;
    });
};
exports.runLoginFlow = runLoginFlow;
