import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Credentials } from "./types";

const credentialsDir = path.join(os.homedir(), ".insighta");
const credentialsPath = path.join(credentialsDir, "credentials.json");

export const getCredentialsPath = () => credentialsPath;

export const readCredentials = async (): Promise<Credentials | null> => {
  try {
    const raw = await readFile(credentialsPath, "utf8");
    return JSON.parse(raw) as Credentials;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
};

export const saveCredentials = async (credentials: Credentials): Promise<void> => {
  await mkdir(credentialsDir, { recursive: true });
  await writeFile(credentialsPath, JSON.stringify(credentials, null, 2), "utf8");
};

export const clearCredentials = async (): Promise<void> => {
  await rm(credentialsPath, { force: true });
};
