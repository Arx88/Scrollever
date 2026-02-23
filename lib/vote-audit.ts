import type { NextRequest } from "next/server"
import { createServiceClient, isServiceClientConfigured } from "@/lib/supabase/service"

type VoteResourceType = "likes" | "superlikes"

function resolveRequestIp(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")
  if (!forwarded) {
    return null
  }

  return forwarded.split(",")[0]?.trim() || null
}

export function logVoteRejection(
  actorId: string,
  resourceType: VoteResourceType,
  resourceId: string,
  code: string,
  request: NextRequest
) {
  if (!isServiceClientConfigured()) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[vote-audit] service role key missing, audit log skipped")
    }
    return
  }

  let serviceClient: ReturnType<typeof createServiceClient>
  try {
    serviceClient = createServiceClient()
  } catch (error) {
    console.error("[vote-audit] service_client_init_failed", error)
    return
  }

  void serviceClient
    .from("admin_audit_logs")
    .insert({
      actor_id: actorId,
      action: "vote.rejected",
      resource_type: resourceType,
      resource_id: resourceId,
      payload: { code },
      ip: resolveRequestIp(request),
      user_agent: request.headers.get("user-agent"),
    })
    .then(({ error }) => {
      if (error) {
        console.error("[vote-audit] insert_failed", error)
      }
    })
}
