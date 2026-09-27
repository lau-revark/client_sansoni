"use server";

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db, schema } from "@/db";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";

export async function login(_prev: { error?: string } | undefined, form: FormData): Promise<{ error?: string }> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/dashboard");

  const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email)).limit(1);
  // Compare against a dummy hash when the user is missing so timing doesn't reveal which emails exist.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? "$2b$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva");
  if (!user || !ok) return { error: "Incorrect email or password" };

  (await cookies()).set(SESSION_COOKIE, await signSession(user.id), sessionCookieOptions);
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}
