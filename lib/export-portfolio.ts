"use client";

import JSZip from "jszip";
import type {
  BundleFile,
  GeneratedContent,
  GitHubProfile,
  PortfolioProject,
  PortfolioTemplate
} from "@/lib/types";
import { renderPortfolioHtml } from "@/lib/render-portfolio";

interface BundleInput {
  profile: GitHubProfile;
  projects: PortfolioProject[];
  content: GeneratedContent;
  template: PortfolioTemplate;
  resume: File;
  images: Record<number, File>;
}

function fileExtension(file: File) {
  const byType: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp"
  };
  return byType[file.type] || file.name.split(".").pop()?.toLowerCase() || "bin";
}

export async function createPortfolioBundle(
  input: BundleInput
): Promise<BundleFile[]> {
  const files: BundleFile[] = [];
  const projects = input.projects.map((project) => {
    const image = project.selected ? input.images[project.id] : undefined;
    if (!image) {
      return { ...project, imageUrl: "" };
    }

    const imageName = `project-${project.id}.${fileExtension(image)}`;
    files.push({ name: imageName, blob: image });
    return { ...project, imageName, imageUrl: imageName };
  });

  const fontResponse = await fetch("/fonts/CalSans-SemiBold.ttf");
  if (!fontResponse.ok) {
    throw new Error("Could not load the portfolio font asset.");
  }

  files.push({
    name: "CalSans-SemiBold.ttf",
    blob: await fontResponse.blob()
  });
  files.push({ name: "resume.pdf", blob: input.resume });

  const html = renderPortfolioHtml({
    profile: input.profile,
    projects,
    content: input.content,
    template: input.template,
    resumeUrl: "resume.pdf",
    fontUrl: "CalSans-SemiBold.ttf"
  });

  files.unshift({
    name: "index.html",
    blob: new Blob([html], { type: "text/html;charset=utf-8" })
  });

  return files;
}

export async function downloadPortfolioZip(
  slug: string,
  files: BundleFile[]
) {
  const zip = new JSZip();
  files.forEach((file) => zip.file(file.name, file.blob));
  const blob = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slug || "portfolio"}.zip`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
