import { z } from "zod";
import type {
  GeneratedContent,
  GitHubProfile,
  PortfolioProject
} from "@/lib/types";

const generatedContentSchema = z.object({
  headline: z.string().min(8).max(120),
  summary: z.string().min(40).max(900),
  skillGroups: z
    .array(
      z.object({
        name: z.string().min(2).max(40),
        skills: z.array(z.string().min(1).max(40)).min(1).max(12)
      })
    )
    .min(2)
    .max(6),
  projectInsights: z.array(
    z.object({
      projectId: z.coerce.number(),
      tagline: z.string().min(8).max(140),
      impact: z.string().min(10).max(280)
    })
  )
});

interface ImageInput {
  projectName: string;
  type: string;
  base64: string;
}

interface GenerationInput {
  profile: GitHubProfile;
  projects: Array<PortfolioProject & { readme?: string }>;
  resumeText: string;
  images: ImageInput[];
}

interface ChatCompletion {
  choices?: Array<{
    message?: {
      content?: string | null;
      tool_calls?: Array<{
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
  }>;
  message?: string;
}

const outputTool = {
  type: "function",
  function: {
    name: "publish_portfolio_content",
    description:
      "Return grounded, polished portfolio copy based only on the supplied GitHub and resume evidence.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["headline", "summary", "skillGroups", "projectInsights"],
      properties: {
        headline: {
          type: "string",
          description:
            "A concise professional headline, maximum 120 characters."
        },
        summary: {
          type: "string",
          description:
            "A first-person professional summary grounded in the provided facts."
        },
        skillGroups: {
          type: "array",
          minItems: 2,
          maxItems: 6,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["name", "skills"],
            properties: {
              name: { type: "string" },
              skills: {
                type: "array",
                minItems: 1,
                maxItems: 12,
                items: { type: "string" }
              }
            }
          }
        },
        projectInsights: {
          type: "array",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["projectId", "tagline", "impact"],
            properties: {
              projectId: { type: "integer" },
              tagline: { type: "string" },
              impact: { type: "string" }
            }
          }
        }
      }
    }
  }
} as const;

function buildPrompt(input: GenerationInput) {
  const repositoryEvidence = input.projects.map((project) => ({
    id: project.id,
    name: project.name,
    description: project.description,
    homepage: project.homepage,
    stars: project.stars,
    forks: project.forks,
    topics: project.topics,
    primaryLanguage: project.language,
    languageBytes: project.languages,
    featured: project.featured,
    readmeExcerpt: project.readme || ""
  }));

  return [
    "Create portfolio copy for this developer.",
    "Use only the evidence supplied below. Never invent employers, years of experience, clients, revenue, user counts, performance numbers, education, or project results.",
    "Infer skills only when supported by repository languages, topics, descriptions, README text, resume text, or screenshots.",
    "Write in a confident, direct, modern tone. Avoid generic claims and buzzword piles.",
    `Return exactly ${input.projects.length} project insights, in the same order as the supplied repositories.`,
    `Use these exact project id and name pairs: ${input.projects
      .map((project) => `${project.id}:${project.name}`)
      .join(", ")}.`,
    "",
    `GitHub profile:\n${JSON.stringify(input.profile)}`,
    "",
    `Selected repositories:\n${JSON.stringify(repositoryEvidence)}`,
    "",
    `Resume text:\n${input.resumeText || "No extractable resume text."}`,
    "",
    input.images.length
      ? `The attached screenshots correspond, in order, to: ${input.images
          .map((image) => image.projectName)
          .join(", ")}. Use visible UI evidence carefully.`
      : "No project screenshots were attached."
  ].join("\n");
}

function clampText(value: string, maximum: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maximum) {
    return normalized;
  }
  return `${normalized.slice(0, maximum - 1).trimEnd()}…`;
}

function fallbackProjectCopy(project: PortfolioProject) {
  const description = project.description.replace(/\s+/g, " ").trim();
  const technology = project.language || project.topics[0] || "web technology";
  const tagline =
    description.length >= 8
      ? clampText(description, 140)
      : clampText(`${project.name}, built with ${technology}.`, 140);
  const impact =
    description.length >= 10
      ? clampText(description, 280)
      : clampText(
          `Explore ${project.name}, a public project built with ${technology}.`,
          280
        );

  return { tagline, impact };
}

function reconcileProjectInsights(
  projects: GenerationInput["projects"],
  insights: GeneratedContent["projectInsights"]
) {
  const expectedIds = new Set(projects.map((project) => project.id));
  const usedIndexes = new Set<number>();
  const exactMatches = new Map<
    number,
    GeneratedContent["projectInsights"][number]
  >();

  insights.forEach((insight, index) => {
    if (expectedIds.has(insight.projectId) && !exactMatches.has(insight.projectId)) {
      exactMatches.set(insight.projectId, insight);
      usedIndexes.add(index);
    }
  });

  const unmatchedInsights = insights.filter((_, index) => !usedIndexes.has(index));
  let unmatchedIndex = 0;

  return projects.map((project) => {
    const exact = exactMatches.get(project.id);
    if (exact) {
      return { ...exact, projectId: project.id };
    }

    const recovered = unmatchedInsights[unmatchedIndex];
    if (recovered) {
      unmatchedIndex += 1;
      return { ...recovered, projectId: project.id };
    }

    return {
      projectId: project.id,
      ...fallbackProjectCopy(project)
    };
  });
}

export async function generatePortfolioContent(
  input: GenerationInput
): Promise<GeneratedContent> {
  const apiKey = process.env.DIGITALOCEAN_MODEL_ACCESS_KEY;
  const model = process.env.DIGITALOCEAN_MODEL || "kimi-k2.6";

  if (!apiKey) {
    throw new Error("DigitalOcean model access key is not configured.");
  }

  const content: Array<Record<string, unknown>> = [
    {
      type: "text",
      text: buildPrompt(input)
    }
  ];

  for (const image of input.images) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${image.type};base64,${image.base64}`
      }
    });
  }

  const response = await fetch(
    "https://inference.do-ai.run/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "system",
            content:
              "You are a precise portfolio editor. Respond through the requested function only. Keep reasoning out of user-facing copy."
          },
          {
            role: "user",
            content
          }
        ],
        tools: [outputTool],
        tool_choice: "auto",
        temperature: 0.35,
        max_tokens: 4000
      }),
      cache: "no-store"
    }
  );

  const payload = (await response.json().catch(() => null)) as ChatCompletion | null;

  if (!response.ok || !payload) {
    throw new Error(
      payload?.message ||
        `DigitalOcean inference failed with HTTP ${response.status}.`
    );
  }

  const message = payload.choices?.[0]?.message;
  const argumentsJson = message?.tool_calls?.find(
    (call) => call.function?.name === "publish_portfolio_content"
  )?.function?.arguments;

  if (!argumentsJson) {
    throw new Error("Kimi did not return the requested portfolio structure.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(argumentsJson);
  } catch {
    throw new Error("Kimi returned malformed portfolio JSON.");
  }

  const generated = generatedContentSchema.parse(parsed);
  return {
    ...generated,
    projectInsights: reconcileProjectInsights(
      input.projects,
      generated.projectInsights
    )
  };
}
