"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearCredentials = exports.saveCredentials = exports.readCredentials = exports.getCredentialsPath = void 0;
const promises_1 = require("node:fs/promises");
const node_os_1 = __importDefault(require("node:os"));
const node_path_1 = __importDefault(require("node:path"));
const credentialsDir = node_path_1.default.join(node_os_1.default.homedir(), ".insighta");
const credentialsPath = node_path_1.default.join(credentialsDir, "credentials.json");
const getCredentialsPath = () => credentialsPath;
exports.getCredentialsPath = getCredentialsPath;
const readCredentials = async () => {
    try {
        const raw = await (0, promises_1.readFile)(credentialsPath, "utf8");
        return JSON.parse(raw);
    }
    catch (error) {
        if (error.code === "ENOENT") {
            return null;
        }
        throw error;
    }
};
exports.readCredentials = readCredentials;
const saveCredentials = async (credentials) => {
    await (0, promises_1.mkdir)(credentialsDir, { recursive: true });
    await (0, promises_1.writeFile)(credentialsPath, JSON.stringify(credentials, null, 2), "utf8");
};
exports.saveCredentials = saveCredentials;
const clearCredentials = async () => {
    await (0, promises_1.rm)(credentialsPath, { force: true });
};
exports.clearCredentials = clearCredentials;
