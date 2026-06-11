import { subdomainSchema } from "@/lib/validation";

interface CpanelEnvelope<T> {
  status?: number;
  data?: T;
  errors?: string[] | null;
  result?: {
    status?: number;
    data?: T;
    errors?: string[] | null;
  };
}

function getConfig() {
  const baseUrl = process.env.CPANEL_BASE_URL?.replace(/\/$/, "");
  const username = process.env.CPANEL_USERNAME;
  const token = process.env.CPANEL_API_TOKEN;
  const rootDomain = process.env.CPANEL_ROOT_DOMAIN;
  const deployRoot = process.env.CPANEL_DEPLOY_ROOT;

  if (!baseUrl || !username || !token || !rootDomain || !deployRoot) {
    throw new Error("cPanel environment variables are incomplete.");
  }

  return { baseUrl, username, token, rootDomain, deployRoot };
}

function authHeader(username: string, token: string) {
  return `cpanel ${username}:${token}`;
}

function normalizeResponse<T>(payload: CpanelEnvelope<T>) {
  const result = payload.result || payload;
  if (result.status !== 1) {
    throw new Error(
      result.errors?.filter(Boolean).join(" ") || "cPanel request failed."
    );
  }
  return result.data as T;
}

async function cpanelGet<T>(
  module: string,
  method: string,
  params: Record<string, string | number> = {}
) {
  const config = getConfig();
  const url = new URL(`${config.baseUrl}/execute/${module}/${method}`);

  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, String(value));
  });

  const response = await fetch(url, {
    headers: {
      Authorization: authHeader(config.username, config.token)
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`cPanel returned HTTP ${response.status}.`);
  }

  return normalizeResponse<T>((await response.json()) as CpanelEnvelope<T>);
}

export async function subdomainIsAvailable(input: string) {
  const slug = subdomainSchema.parse(input);
  const { rootDomain } = getConfig();
  const domains = await cpanelGet<{
    sub_domains?: string[];
    addon_domains?: string[];
    parked_domains?: string[];
    main_domain?: string;
  }>("DomainInfo", "list_domains", { hide_temporary_domains: 1 });

  const target = `${slug}.${rootDomain}`.toLowerCase();
  const allDomains = [
    domains.main_domain,
    ...(domains.sub_domains || []),
    ...(domains.addon_domains || []),
    ...(domains.parked_domains || [])
  ]
    .filter(Boolean)
    .map((domain) => String(domain).toLowerCase());

  return {
    available: !allDomains.includes(target),
    domain: target
  };
}

export async function createPortfolioSubdomain(input: string) {
  const slug = subdomainSchema.parse(input);
  const config = getConfig();
  const directory = `${config.deployRoot}/${slug}`;

  await cpanelGet("SubDomain", "addsubdomain", {
    domain: slug,
    rootdomain: config.rootDomain,
    dir: directory,
    disallowdot: 1
  });

  return {
    domain: `${slug}.${config.rootDomain}`,
    directory
  };
}

export async function uploadPortfolioFiles(
  directory: string,
  files: Array<{ name: string; bytes: ArrayBuffer; type: string }>
) {
  const config = getConfig();
  const body = new FormData();
  body.append("dir", directory);

  files.forEach((file, index) => {
    body.append(
      `file-${index + 1}`,
      new Blob([file.bytes], {
        type: file.type || "application/octet-stream"
      }),
      file.name
    );
  });

  const response = await fetch(
    `${config.baseUrl}/execute/Fileman/upload_files`,
    {
      method: "POST",
      headers: {
        Authorization: authHeader(config.username, config.token)
      },
      body,
      cache: "no-store"
    }
  );

  if (!response.ok) {
    throw new Error(`cPanel upload returned HTTP ${response.status}.`);
  }

  normalizeResponse((await response.json()) as CpanelEnvelope<unknown>);
}

export async function startAutoSsl() {
  try {
    await cpanelGet("SSL", "start_autossl_check");
  } catch {
    // AutoSSL may be disabled by the host; deployment itself is still valid.
  }
}

export function getPortfolioBaseDomain() {
  return getConfig().rootDomain;
}
