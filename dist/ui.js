"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.printError = exports.printPaginationSummary = exports.printProfiles = exports.printUser = exports.withSpinner = void 0;
const table_1 = require("table");
const withSpinner = async (text, fn) => {
    const { default: ora } = await import("ora");
    const spinner = ora(text).start();
    try {
        const result = await fn();
        spinner.succeed();
        return result;
    }
    catch (error) {
        spinner.fail();
        throw error;
    }
};
exports.withSpinner = withSpinner;
const printUser = (user) => {
    const rows = [
        ["Field", "Value"],
        ["ID", user.id],
        ["Username", user.username],
        ["GitHub ID", user.github_id],
        ["Email", user.email ?? "-"],
        ["Role", user.role],
        ["Active", String(user.is_active)],
        ["Last Login", user.last_login_at]
    ];
    console.log((0, table_1.table)(rows));
};
exports.printUser = printUser;
const printProfiles = (profiles) => {
    if (profiles.length === 0) {
        console.log("No profiles found.");
        return;
    }
    const rows = [
        ["ID", "Name", "Gender", "Age", "Age Group", "Country", "Gender P", "Country P", "Created"]
    ];
    for (const profile of profiles) {
        rows.push([
            profile.id,
            profile.name,
            profile.gender,
            String(profile.age),
            profile.age_group,
            `${profile.country_name} (${profile.country_id})`,
            profile.gender_probability.toFixed(2),
            profile.country_probability.toFixed(2),
            new Date(profile.created_at).toLocaleString()
        ]);
    }
    console.log((0, table_1.table)(rows));
};
exports.printProfiles = printProfiles;
const printPaginationSummary = (page, limit, total, totalPages) => {
    console.log(`page=${page} limit=${limit} total=${total} total_pages=${totalPages}`);
};
exports.printPaginationSummary = printPaginationSummary;
const printError = (message) => {
    console.error(`Error: ${message}`);
};
exports.printError = printError;
