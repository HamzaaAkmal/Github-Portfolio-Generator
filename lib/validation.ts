import { z } from "zod";

export const usernameSchema = z
  .string()
  .trim()
  .min(1, "Enter a GitHub username.")
  .max(39, "GitHub usernames are at most 39 characters.")
  .regex(
    /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/,
    "Enter a valid GitHub username."
  );

const reservedSubdomains = new Set([
  "www",
  "mail",
  "ftp",
  "cpanel",
  "webmail",
  "webdisk",
  "whm",
  "server",
  "api",
  "admin"
]);

export const subdomainSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Use at least 3 characters.")
  .max(30, "Use at most 30 characters.")
  .regex(
    /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/,
    "Use lowercase letters, numbers, and single hyphens."
  )
  .refine((value) => !reservedSubdomains.has(value), {
    message: "That name is reserved."
  });

export const selectedProjectSchema = z.object({
  id: z.number(),
  owner: z.string(),
  name: z.string(),
  fullName: z.string(),
  description: z.string(),
  htmlUrl: z.string(),
  homepage: z.string(),
  language: z.string(),
  languages: z.record(z.string(), z.number()),
  stars: z.number(),
  forks: z.number(),
  topics: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
  selected: z.boolean(),
  featured: z.boolean(),
  custom: z.boolean().optional(),
  imageName: z.string().optional(),
  imageUrl: z.string().optional(),
  aiTagline: z.string().optional(),
  aiImpact: z.string().optional()
});

export const profileSchema = z.object({
  login: z.string(),
  name: z.string(),
  avatarUrl: z.string(),
  bio: z.string(),
  location: z.string(),
  company: z.string(),
  email: z.string(),
  blog: z.string(),
  htmlUrl: z.string(),
  followers: z.number(),
  following: z.number(),
  publicRepos: z.number(),
  socials: z.array(
    z.object({
      provider: z.string(),
      url: z.string()
    })
  )
});

export const aiRequestSchema = z.object({
  profile: profileSchema,
  projects: z.array(selectedProjectSchema).min(1).max(10),
  imageProjectIds: z.array(z.number()).max(3)
});
