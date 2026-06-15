// The authenticated principal extracted from a verified JWT and attached to
// the request. This is the tenant context every protected handler relies on.
export interface AuthUser {
  id: string
  email: string
}
