import { NextResponse } from "next/server";
import { apiErrorMessage } from "@/lib/api-error";
import { importGitHubUser } from "@/lib/github";
import { usernameSchema } from "@/lib/validation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { username?: string };
    const username = usernameSchema.parse(body.username);
    const data = await importGitHubUser(username);
    return NextResponse.json(data);
  } catch (error) {
    const message = apiErrorMessage(
      error,
      "Unable to import GitHub profile."
    );
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
