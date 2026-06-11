import { NextResponse } from "next/server";
import { apiErrorMessage } from "@/lib/api-error";
import {
  createPortfolioSubdomain,
  startAutoSsl,
  subdomainIsAvailable,
  uploadPortfolioFiles
} from "@/lib/cpanel";
import { subdomainSchema } from "@/lib/validation";

export const runtime = "nodejs";
export const maxDuration = 120;

function safeFilename(name: string) {
  const filename = name.split(/[\\/]/).pop() || "";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,120}$/.test(filename)) {
    throw new Error(`Invalid bundle filename: ${filename || "unnamed file"}.`);
  }
  return filename;
}

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const slug = subdomainSchema.parse(form.get("slug"));
    const incomingFiles = form
      .getAll("files")
      .filter((value): value is File => value instanceof File);

    if (!incomingFiles.some((file) => file.name === "index.html")) {
      throw new Error("The generated index.html file is missing.");
    }
    if (!incomingFiles.some((file) => file.name === "resume.pdf")) {
      throw new Error("The resume PDF is missing from the bundle.");
    }
    if (incomingFiles.length > 16) {
      throw new Error("The deployment bundle contains too many files.");
    }

    const totalSize = incomingFiles.reduce((sum, file) => sum + file.size, 0);
    if (totalSize > 30 * 1024 * 1024) {
      throw new Error("The deployment bundle must be 30 MB or smaller.");
    }

    const availability = await subdomainIsAvailable(slug);
    if (!availability.available) {
      throw new Error(`${availability.domain} is already taken.`);
    }

    const destination = await createPortfolioSubdomain(slug);
    const files = [];
    for (const file of incomingFiles) {
      files.push({
        name: safeFilename(file.name),
        bytes: await file.arrayBuffer(),
        type: file.type
      });
    }

    await uploadPortfolioFiles(destination.directory, files);
    await startAutoSsl();

    return NextResponse.json({
      domain: destination.domain,
      url: `https://${destination.domain}`
    });
  } catch (error) {
    const message = apiErrorMessage(error, "Unable to deploy portfolio.");
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
