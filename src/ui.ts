import ora from "ora";
import { table } from "table";
import { Profile, User } from "./types";

export const withSpinner = async <T>(text: string, fn: () => Promise<T>): Promise<T> => {
  const spinner = ora(text).start();
  try {
    const result = await fn();
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
};

export const printUser = (user: User): void => {
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
  console.log(table(rows));
};

export const printProfiles = (profiles: Profile[]): void => {
  if (profiles.length === 0) {
    console.log("No profiles found.");
    return;
  }

  const rows: string[][] = [
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

  console.log(table(rows));
};

export const printPaginationSummary = (page: number, limit: number, total: number, totalPages: number): void => {
  console.log(`page=${page} limit=${limit} total=${total} total_pages=${totalPages}`);
};

export const printError = (message: string): void => {
  console.error(`Error: ${message}`);
};
