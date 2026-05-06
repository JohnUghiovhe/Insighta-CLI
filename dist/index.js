"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const commander_1 = require("commander");
const api_1 = require("./api");
const auth_1 = require("./auth");
const storage_1 = require("./storage");
const ui_1 = require("./ui");
const DEFAULT_BASE_URL = process.env.INSIGHTA_API_BASE_URL || "http://localhost:3021";
const DEFAULT_CALLBACK_PORT = Number(process.env.INSIGHTA_CALLBACK_PORT || 8787);
const program = new commander_1.Command();
const api = new api_1.InsightaApi();
const appendOptional = (params, key, value) => {
    if (typeof value === "string" && value.trim()) {
        params.set(key, value.trim());
    }
    if (typeof value === "number" && !Number.isNaN(value)) {
        params.set(key, String(value));
    }
};
const run = async (fn) => {
    try {
        await fn();
    }
    catch (error) {
        (0, ui_1.printError)(error instanceof Error ? error.message : "Unknown error");
        process.exitCode = 1;
    }
};
program.name("insighta").description("Insighta Labs CLI").version("1.0.0");
program
    .command("login")
    .description("Authenticate with GitHub OAuth")
    .option("--base-url <url>", "Backend URL", DEFAULT_BASE_URL)
    .option("--callback-port <port>", "Local callback port", String(DEFAULT_CALLBACK_PORT))
    .action((options) => run(async () => {
    const result = await (0, auth_1.runLoginFlow)({
        baseUrl: options.baseUrl,
        callbackPort: Number(options.callbackPort)
    });
    await api.loginWithCallbackPayload(options.baseUrl, result);
    console.log(`Logged in as ${result.data.username}`);
    console.log(`Credentials saved to ${(0, storage_1.getCredentialsPath)()}`);
}));
program
    .command("logout")
    .description("Revoke session and clear local credentials")
    .action(() => run(async () => {
    await api.loadCredentials();
    await (0, ui_1.withSpinner)("Logging out...", async () => {
        await api.logout();
    });
    console.log("Logged out.");
}));
program
    .command("whoami")
    .description("Show current authenticated user")
    .action(() => run(async () => {
    await api.loadCredentials();
    const user = await (0, ui_1.withSpinner)("Fetching current user...", async () => api.fetchWhoAmI());
    (0, ui_1.printUser)(user);
}));
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
    .action((options) => run(async () => {
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
    const response = await (0, ui_1.withSpinner)("Fetching profiles...", async () => api.listProfiles(params));
    (0, ui_1.printProfiles)(response.data);
    (0, ui_1.printPaginationSummary)(response.page, response.limit, response.total, response.total_pages);
}));
program
    .command("bootstrap")
    .alias("demo-login")
    .description("Create a local demo session without browser OAuth")
    .option("--base-url <url>", "Backend URL", DEFAULT_BASE_URL)
    .option("--role <role>", "Bootstrap role: analyst|admin", "analyst")
    .action((options) => run(async () => {
    const role = options.role === "admin" ? "admin" : "analyst";
    const result = await (0, auth_1.runBootstrapLoginFlow)({ baseUrl: options.baseUrl, role });
    await api.loginWithCallbackPayload(options.baseUrl, result);
    console.log(`Bootstrapped as ${result.data.username}`);
    console.log(`Role: ${result.data.role}`);
    console.log(`Credentials saved to ${(0, storage_1.getCredentialsPath)()}`);
}));
profiles
    .command("get")
    .argument("<id>", "Profile ID")
    .description("Get profile by ID")
    .action((id) => run(async () => {
    await api.loadCredentials();
    const profile = await (0, ui_1.withSpinner)("Fetching profile...", async () => api.getProfile(id));
    (0, ui_1.printProfiles)([profile]);
}));
profiles
    .command("search")
    .argument("<query>", "Natural-language profile query")
    .description("Search profiles with natural language")
    .action((query) => run(async () => {
    await api.loadCredentials();
    const response = await (0, ui_1.withSpinner)("Searching profiles...", async () => api.searchProfiles(query));
    (0, ui_1.printProfiles)(response.data);
    (0, ui_1.printPaginationSummary)(response.page, response.limit, response.total, response.total_pages);
}));
profiles
    .command("create")
    .requiredOption("--name <name>", "Profile name")
    .description("Create profile from name")
    .action((options) => run(async () => {
    await api.loadCredentials();
    const profile = await (0, ui_1.withSpinner)("Creating profile...", async () => api.createProfile(options.name));
    (0, ui_1.printProfiles)([profile]);
}));
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
    .action((options) => run(async () => {
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
    const filePath = await (0, ui_1.withSpinner)("Exporting profiles...", async () => api.exportProfiles("csv", params));
    console.log(`CSV exported to ${filePath}`);
}));
profiles
    .command("upload")
    .description("Upload a CSV file of profiles")
    .requiredOption("--file <path>", "Path to CSV file to upload")
    .action((options) => run(async () => {
    await api.loadCredentials();
    const result = await (0, ui_1.withSpinner)("Uploading CSV...", async () => api.uploadProfiles(options.file));
    console.log("Upload summary:", result);
}));
program.parseAsync(process.argv);
