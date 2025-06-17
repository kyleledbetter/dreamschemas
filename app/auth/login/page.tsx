import { LoginForm } from "@/components/login-form";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Page() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // Debug logging (remove in production)
  console.log(
    "Login page - User:",
    user?.id ? "authenticated" : "not authenticated"
  );
  console.log("Login page - Error:", error?.message || "none");

  // If we have a user and no error, redirect to dashboard
  if (user && !error) {
    console.log("Redirecting authenticated user to dashboard");
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  );
}
