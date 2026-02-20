export const ROLE_VALUES = ["user", "moderator", "admin", "owner"] as const
export type AppRole = (typeof ROLE_VALUES)[number]

const ROLE_SET = new Set<AppRole>(ROLE_VALUES)
const ADMIN_ROLE_SET = new Set<AppRole>(["admin", "owner"])
const MODERATOR_ROLE_SET = new Set<AppRole>(["moderator", "admin", "owner"])

export function normalizeRole(input: unknown): AppRole {
  if (typeof input !== "string") {
    return "user"
  }

  const normalized = input as AppRole
  return ROLE_SET.has(normalized) ? normalized : "user"
}

export function isAdminRole(input: unknown): boolean {
  return ADMIN_ROLE_SET.has(normalizeRole(input))
}

export function isModeratorRole(input: unknown): boolean {
  return MODERATOR_ROLE_SET.has(normalizeRole(input))
}
