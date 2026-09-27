import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { SESSION_COOKIE, verifySession } from "./session";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "viewer";
  speakerId: string | null;
  speakerName: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const userId = await verifySession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!userId) return null;
  const [row] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      role: schema.users.role,
      speakerId: schema.users.speakerId,
      speakerName: schema.speakers.name,
    })
    .from(schema.users)
    .leftJoin(schema.speakers, eq(schema.speakers.id, schema.users.speakerId))
    .where(eq(schema.users.id, userId))
    .limit(1);
  return row ?? null;
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
