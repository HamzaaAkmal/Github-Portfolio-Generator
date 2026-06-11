import type {
  GitHubImportResponse,
  GitHubProfile,
  PortfolioProject,
  SocialLink
} from "@/lib/types";

const GITHUB_API = "https://api.github.com";
const API_VERSION = "2026-03-10";

function headers() {
  const requestHeaders: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": API_VERSION,
    "User-Agent": "voiceresume-github-portfolio-generator"
  };

  if (process.env.GITHUB_TOKEN) {
    requestHeaders.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  return requestHeaders;
}

async function githubFetch<T>(path: string): Promise<{
  data: T;
  response: Response;
}> {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: headers(),
    cache: "no-store"
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    const message =
      response.status === 404
        ? "GitHub user not found."
        : payload?.message || `GitHub request failed with ${response.status}.`;
    throw new Error(message);
  }

  return {
    data: (await response.json()) as T,
    response
  };
}

function normalizeUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return "";
  }

  const trimmed = value.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export async function importGitHubUser(
  username: string
): Promise<GitHubImportResponse> {
  const userRequest = githubFetch<Record<string, unknown>>(`/users/${username}`);
  const reposRequest = githubFetch<Array<Record<string, unknown>>>(
    `/users/${username}/repos?per_page=100&sort=updated&type=owner`
  );
  const socialsRequest = githubFetch<Array<Record<string, unknown>>>(
    `/users/${username}/social_accounts`
  ).catch(() => ({ data: [], response: new Response() }));

  const [userResult, reposResult, socialsResult] = await Promise.all([
    userRequest,
    reposRequest,
    socialsRequest
  ]);

  const user = userResult.data;
  const socials: SocialLink[] = socialsResult.data
    .map((social) => ({
      provider: String(social.provider || "website"),
      url: normalizeUrl(social.url)
    }))
    .filter((social) => Boolean(social.url));

  const profile: GitHubProfile = {
    login: String(user.login || username),
    name: String(user.name || user.login || username),
    avatarUrl: String(user.avatar_url || ""),
    bio: String(user.bio || ""),
    location: String(user.location || ""),
    company: String(user.company || ""),
    email: String(user.email || ""),
    blog: normalizeUrl(user.blog),
    htmlUrl: String(user.html_url || `https://github.com/${username}`),
    followers: Number(user.followers || 0),
    following: Number(user.following || 0),
    publicRepos: Number(user.public_repos || 0),
    socials
  };

  const repositories = reposResult.data
    .filter(
      (repo) =>
        repo.private === false &&
        repo.archived !== true &&
        repo.disabled !== true &&
        repo.fork !== true
    )
    .map<PortfolioProject>((repo) => ({
      id: Number(repo.id),
      owner: String(
        (repo.owner as Record<string, unknown> | undefined)?.login || username
      ),
      name: String(repo.name || ""),
      fullName: String(repo.full_name || `${username}/${String(repo.name || "")}`),
      description: String(repo.description || ""),
      htmlUrl: String(repo.html_url || ""),
      homepage: normalizeUrl(repo.homepage),
      language: String(repo.language || ""),
      languages: {},
      stars: Number(repo.stargazers_count || 0),
      forks: Number(repo.forks_count || 0),
      topics: Array.isArray(repo.topics)
        ? repo.topics.map((topic) => String(topic))
        : [],
      createdAt: String(repo.created_at || ""),
      updatedAt: String(repo.updated_at || ""),
      selected: false,
      featured: false
    }))
    .sort((a, b) => {
      const starDifference = b.stars - a.stars;
      if (starDifference !== 0) {
        return starDifference;
      }
      return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
    })
    .map((repo, index) => ({
      ...repo,
      selected: index < 10,
      featured: index < 3
    }));

  return {
    profile,
    repositories,
    rateLimitRemaining: Number.isFinite(
      Number(reposResult.response.headers.get("x-ratelimit-remaining"))
    )
      ? Number(reposResult.response.headers.get("x-ratelimit-remaining"))
      : null
  };
}

export async function getRepositoryLanguages(
  owner: string,
  repo: string
): Promise<Record<string, number>> {
  const result = await githubFetch<Record<string, number>>(
    `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/languages`
  );
  return result.data;
}

export async function getRepositoryReadme(
  owner: string,
  repo: string
): Promise<string> {
  try {
    const result = await githubFetch<{
      content?: string;
      encoding?: string;
    }>(
      `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/readme`
    );

    if (result.data.encoding !== "base64" || !result.data.content) {
      return "";
    }

    return Buffer.from(result.data.content.replace(/\n/g, ""), "base64")
      .toString("utf8")
      .slice(0, 6000);
  } catch {
    return "";
  }
}
