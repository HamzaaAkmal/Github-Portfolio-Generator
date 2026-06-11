export type PortfolioTemplate = "obsidian" | "aurora" | "signal";

export interface SocialLink {
  provider: string;
  url: string;
}

export interface GitHubProfile {
  login: string;
  name: string;
  avatarUrl: string;
  bio: string;
  location: string;
  company: string;
  email: string;
  blog: string;
  htmlUrl: string;
  followers: number;
  following: number;
  publicRepos: number;
  socials: SocialLink[];
}

export interface PortfolioProject {
  id: number;
  owner: string;
  name: string;
  fullName: string;
  description: string;
  htmlUrl: string;
  homepage: string;
  language: string;
  languages: Record<string, number>;
  stars: number;
  forks: number;
  topics: string[];
  createdAt: string;
  updatedAt: string;
  selected: boolean;
  featured: boolean;
  custom?: boolean;
  imageName?: string;
  imageUrl?: string;
  aiTagline?: string;
  aiImpact?: string;
}

export interface SkillGroup {
  name: string;
  skills: string[];
}

export interface GeneratedContent {
  headline: string;
  summary: string;
  skillGroups: SkillGroup[];
  projectInsights: Array<{
    projectId: number;
    tagline: string;
    impact: string;
  }>;
}

export interface PortfolioData {
  profile: GitHubProfile;
  projects: PortfolioProject[];
  content: GeneratedContent;
  template: PortfolioTemplate;
  resumeUrl: string;
  fontUrl: string;
}

export interface GitHubImportResponse {
  profile: GitHubProfile;
  repositories: PortfolioProject[];
  rateLimitRemaining: number | null;
}

export interface BundleFile {
  name: string;
  blob: Blob;
}
