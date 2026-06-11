import { NextResponse } from "next/server";
import { apiErrorMessage } from "@/lib/api-error";
import {
  getPortfolioBaseDomain,
  subdomainIsAvailable
} from "@/lib/cpanel";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const result = await subdomainIsAvailable(url.searchParams.get("slug") || "");
    return NextResponse.json(result);
  } catch (error) {
    const message = apiErrorMessage(error, "Unable to check that name.");
    return NextResponse.json(
      { error: message, baseDomain: getPortfolioBaseDomain() },
      { status: 400 }
    );
  }
}
