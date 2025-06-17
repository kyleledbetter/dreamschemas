"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getSupabaseOAuth } from "@/lib/supabase/oauth";
import { Card, CardContent } from "@/components/ui/card";
import { RefreshCw } from "lucide-react";

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const code = searchParams.get("code");
        const state = searchParams.get("state");

        if (!code || !state) {
          throw new Error("Missing callback parameters");
        }

        const oauth = getSupabaseOAuth();
        const { workflowState } = await oauth.handleCallback(code, state);

        // If we have a workflow state, redirect to the saved path
        if (workflowState) {
          router.push(workflowState.returnPath);
        } else {
          router.push("/dashboard");
        }
      } catch (error) {
        console.error("OAuth callback error:", error);
        router.push("/auth/error?error=oauth_callback_failed");
      }
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="container max-w-lg mx-auto py-12">
      <Card>
        <CardContent className="py-6">
          <div className="flex flex-col items-center justify-center space-y-4 text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <h2 className="text-lg font-medium">Connecting to Supabase</h2>
            <p className="text-sm text-muted-foreground">
              Please wait while we complete the connection...
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function SupabaseOAuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="container max-w-lg mx-auto py-12">
          <Card>
            <CardContent className="py-6">
              <div className="flex flex-col items-center justify-center space-y-4 text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-primary" />
                <h2 className="text-lg font-medium">Loading...</h2>
                <p className="text-sm text-muted-foreground">Please wait...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
