import "dotenv/config";
import { Command } from "commander";
import { InsightaApi } from "./api";
import { runBootstrapLoginFlow, runLoginFlow } from "./auth";
import { getCredentialsPath } from "./storage";
import { printError, printPaginationSummary, printProfiles, printUser, withSpinner } from "./ui";
import type { Role } from "./types";

const DEFAULT_BASE_URL = process.env.INSIGHTA_API_BASE_URL || "http://localhost:3021";
const DEFAULT_CALLBACK_PORT = Number(process.env.INSIGHTA_CALLBACK_PORT || 8787);

const program = new Command();
const api = new InsightaApi();

const appendOptional = (params: URLSearchParams, key: string, value: unknown): void => {
  if (typeof value === "string" && value.trim()) {
    params.set(key, value.trim());
  }
  if (typeof value === "number" && !Number.isNaN(value)) {
    params.set(key, String(value));
  }
};

const run = async (fn: () => Promise<void>): Promise<void> => {
  try {
    await fn();
  } catch (error) {
    printError(error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  }
};

program.name("insighta").description("Insighta Labs CLI").version("1.0.0");

program
  .command("login")
  .description("Authenticate with GitHub OAuth")
  .option("--base-url <url>", "Backend URL", DEFAULT_BASE_URL)
  .option("--callback-port <port>", "Local callback port", String(DEFAULT_CALLBACK_PORT))
  .action((options: { baseUrl: string; callbackPort: string }) =>
    run(async () => {
      const result = await runLoginFlow({
        baseUrl: options.baseUrl,
        callbackPort: Number(options.callbackPort)
      });
      await api.loginWithCallbackPayload(options.baseUrl, result);
      console.log(`Logged in as ${result.data.username}`);
      console.log(`Credentials saved to ${getCredentialsPath()}`);
    })
  );

program
  .command("logout")
  .description("Revoke session and clear local credentials")
  .action(() =>
    run(async () => {
      await api.loadCredentials();
      await withSpinner("Logging out...", async () => {
        await api.logout();
      });
      console.log("Logged out.");
    })
  );

program
  .command("whoami")
  .description("Show current authenticated user")
  .action(() =>
    run(async () => {
      await api.loadCredentials();
      const user = await withSpinner("Fetching current user...", async () => api.fetchWhoAmI());
      printUser(user);
    })
  );

const profiles = program.command("profiles").description("Profile operations");

profiles
  .command("list")
  .description("List profiles with optional filters")
  .option("--gender <gender>", "male|female")
  .option("--country <country>", "ISO2 country code, e.g. NG")
  .option("--age-group <ageGroup>", "child|teenager|adult|senior")
  .option("--min-age <minAge>", "Minimum age", Number)
  .option("--max-age <maxAge>", "Maximum age", Number)
  .option("--sort-by <sortBy>", "age|created_at|gender_probability")
  .option("--order <order>", "asc|desc")
  .option("--page <page>", "Page number", Number)
  .option("--limit <limit>", "Items per page", Number)
  .action(
    (options: {
      gender?: string;
      country?: string;
      ageGroup?: string;
      minAge?: number;
      maxAge?: number;
      sortBy?: string;
      order?: string;
      page?: number;
      limit?: number;
    }) =>
      run(async () => {
        await api.loadCredentials();
        const params = new URLSearchParams();
        appendOptional(params, "gender", options.gender);
        appendOptional(params, "country_id", options.country?.toUpperCase());
        appendOptional(params, "age_group", options.ageGroup);
        appendOptional(params, "min_age", options.minAge);
        appendOptional(params, "max_age", options.maxAge);
        appendOptional(params, "sort_by", options.sortBy);
        appendOptional(params, "order", options.order);
        appendOptional(params, "page", options.page);
        appendOptional(params, "limit", options.limit);

        const response = await withSpinner("Fetching profiles...", async () => api.listProfiles(params));
        printProfiles(response.data);
        printPaginationSummary(response.page, response.limit, response.total, response.total_pages);
      })
  );

program
  .command("bootstrap")
  .alias("demo-login")
  .description("Create a local demo session without browser OAuth")
  .option("--base-url <url>", "Backend URL", DEFAULT_BASE_URL)
  .option("--role <role>", "Bootstrap role: analyst|admin", "analyst")
  .action((options: { baseUrl: string; role: Role }) =>
    run(async () => {
      const role = options.role === "admin" ? "admin" : "analyst";
      const result = await runBootstrapLoginFlow({ baseUrl: options.baseUrl, role });
      await api.loginWithCallbackPayload(options.baseUrl, result);
      console.log(`Bootstrapped as ${result.data.username}`);
      console.log(`Role: ${result.data.role}`);
      console.log(`Credentials saved to ${getCredentialsPath()}`);
    })
  );

profiles
  .command("get")
  .argument("<id>", "Profile ID")
  .description("Get profile by ID")
  .action((id: string) =>
    run(async () => {
      await api.loadCredentials();
      const profile = await withSpinner("Fetching profile...", async () => api.getProfile(id));
      printProfiles([profile]);
    })
  );

profiles
  .command("search")
  .argument("<query>", "Natural-language profile query")
  .description("Search profiles with natural language")
  .action((query: string) =>
    run(async () => {
      await api.loadCredentials();
      const response = await withSpinner("Searching profiles...", async () => api.searchProfiles(query));
      printProfiles(response.data);
      printPaginationSummary(response.page, response.limit, response.total, response.total_pages);
    })
  );

profiles
  .command("create")
  .requiredOption("--name <name>", "Profile name")
  .description("Create profile from name")
  .action((options: { name: string }) =>
    run(async () => {
      await api.loadCredentials();
      const profile = await withSpinner("Creating profile...", async () => api.createProfile(options.name));
      printProfiles([profile]);
    })
  );

profiles
  .command("export")
  .requiredOption("--format <format>", "Export format (csv only)")
  .option("--gender <gender>", "male|female")
  .option("--country <country>", "ISO2 country code, e.g. NG")
  .option("--age-group <ageGroup>", "child|teenager|adult|senior")
  .option("--min-age <minAge>", "Minimum age", Number)
  .option("--max-age <maxAge>", "Maximum age", Number)
  .option("--sort-by <sortBy>", "age|created_at|gender_probability")
  .option("--order <order>", "asc|desc")
  .action(
    (options: {
      format: string;
      gender?: string;
      country?: string;
      ageGroup?: string;
      minAge?: number;
      maxAge?: number;
      sortBy?: string;
      order?: string;
    }) =>
      run(async () => {
        if (options.format !== "csv") {
          throw new Error("Only csv format is supported.");
        }
        await api.loadCredentials();
        const params = new URLSearchParams();
        appendOptional(params, "gender", options.gender);
        appendOptional(params, "country_id", options.country?.toUpperCase());
        appendOptional(params, "age_group", options.ageGroup);
        appendOptional(params, "min_age", options.minAge);
        appendOptional(params, "max_age", options.maxAge);
        appendOptional(params, "sort_by", options.sortBy);
        appendOptional(params, "order", options.order);

        const filePath = await withSpinner("Exporting profiles...", async () => api.exportProfiles("csv", params));
        console.log(`CSV exported to ${filePath}`);
      })
  );

profiles
  .command("upload")
  .description("Upload a CSV file of profiles")
  .requiredOption("--file <path>", "Path to CSV file to upload")
  .action((options: { file: string }) =>
    run(async () => {
      await api.loadCredentials();
      const result = await withSpinner("Uploading CSV...", async () => api.uploadProfiles(options.file));
      console.log("Upload summary:", result);
    })
  );

program.parseAsync(process.argv);
