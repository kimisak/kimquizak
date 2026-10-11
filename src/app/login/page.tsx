import Link from "next/link";
import { redirect } from "next/navigation";
import { getOwner } from "@/lib/auth/owner";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  if (await getOwner()) redirect("/account");
  return <main className="owner-panel">
    <h1>Host login</h1>
    <p>Sign in to save private quizzes and use Street View.</p>
    <LoginForm />
    <Link href="/">Continue with the public demo</Link>
  </main>;
}
