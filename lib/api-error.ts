import { ZodError } from "zod";

export function apiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
}
