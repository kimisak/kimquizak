import { redirect } from "next/navigation";
import { getOwner } from "@/lib/auth/owner";
import { signOut } from "@/app/login/actions";
import { PrivateArchive } from "./PrivateArchive";

export default async function AccountPage() {
  if (!await getOwner()) redirect("/login");
  return <main className="owner-panel">
    <h1>Your private archive</h1>
    <p>Save a copy of this browser’s quiz, then open a saved copy in the editor on any device. Nothing uploads automatically.</p>
    <PrivateArchive />
    <p>Quiz data you create or import stays in this browser after signing out. On a shared device, use “Clear everything” in the local archive before leaving.</p>
    <form action={signOut}><button className="button ghost">Sign out</button></form>
  </main>;
}
