import { NextResponse } from "next/server";
import { apiErrorMessage } from "@/lib/api-error";
import { generatePortfolioContent } from "@/lib/digitalocean";
import {
  getRepositoryLanguages,
  getRepositoryReadme
} from "@/lib/github";
import { extractPdfText } from "@/lib/pdf";
import { aiRequestSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const rawData = form.get("data");
    const resume = form.get("resume");

    if (typeof rawData !== "string") {
      throw new Error("Portfolio data is missing.");
    }
    if (!(resume instanceof File) || resume.type !== "application/pdf") {
      throw new Error("Upload a PDF resume before generating.");
    }
    if (resume.size > 12 * 1024 * 1024) {
      throw new Error("Resume must be 12 MB or smaller.");
    }

    const parsed = aiRequestSchema.parse(JSON.parse(rawData));
    const projects = [];

    for (const project of parsed.projects) {
      let languages = project.languages;
      let readme = "";

      if (!project.custom && project.owner && project.name) {
        languages = await getRepositoryLanguages(
          project.owner,
          project.name
        ).catch(() => project.languages);
        if (project.featured) {
          readme = await getRepositoryReadme(project.owner, project.name);
        }
      }

      projects.push({ ...project, languages, readme });
    }

    const imageFiles = form
      .getAll("images")
      .filter((value): value is File => value instanceof File)
      .slice(0, 3);
    const images = [];

    for (let index = 0; index < imageFiles.length; index += 1) {
      const image = imageFiles[index];
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(image.type) ||
        image.size > 4 * 1024 * 1024
      ) {
        continue;
      }
      const projectId = parsed.imageProjectIds[index];
      const project = projects.find((candidate) => candidate.id === projectId);
      images.push({
        projectName: project?.name || `Project ${index + 1}`,
        type: image.type,
        base64: Buffer.from(await image.arrayBuffer()).toString("base64")
      });
    }

    const resumeText = await extractPdfText(resume).catch(() => "");
    const content = await generatePortfolioContent({
      profile: parsed.profile,
      projects,
      resumeText,
      images
    });

    return NextResponse.json({
      content,
      languages: projects.map((project) => ({
        id: project.id,
        languages: project.languages
      }))
    });
  } catch (error) {
    const message = apiErrorMessage(
      error,
      "Unable to generate portfolio content."
    );
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
