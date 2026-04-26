export type Role = "admin" | "analyst";

export interface User {
  id: string;
  github_id: string;
  username: string;
  email: string | null;
  avatar_url: string | null;
  role: Role;
  is_active: boolean;
  last_login_at: string;
  created_at: string;
}

export interface Credentials {
  base_url: string;
  access_token: string;
  refresh_token: string;
  access_token_expires_at: string;
  refresh_token_expires_at: string;
  user: User;
}

export interface Profile {
  id: string;
  name: string;
  gender: "male" | "female";
  gender_probability: number;
  age: number;
  age_group: "child" | "teenager" | "adult" | "senior";
  country_id: string;
  country_name: string;
  country_probability: number;
  created_at: string;
}

export interface ListResponse {
  status: "success";
  page: number;
  limit: number;
  total: number;
  total_pages: number;
  data: Profile[];
}

export interface SingleProfileResponse {
  status: "success";
  data: Profile;
}
