# Interaction Map — <APP NAME>  (functional traceability matrix)
_Reconstructed spec: every interactive element, what it should do, what it's wired to, and whether it works._
_Status values: ok | broken | not-wired | unknown-intent_

## Route: <e.g. /login>
| Element | Type | Expected behavior | Reads/Writes (table.column) or Endpoint | Status | Evidence |
|---|---|---|---|---|---|
| "Log in" | button | authenticate, then route to /dashboard | Supabase Auth (signInWithPassword) | | |
| "Forgot password" | link | route to /reset | — | | |

## Route: <e.g. /dashboard>
| Element | Type | Expected behavior | Reads/Writes or Endpoint | Status | Evidence |
|---|---|---|---|---|---|
| "New record" | button | open form, insert row, refresh list | orders.(title,amount,user_id) | | |
| "Edit" | button | load row into form, update | orders (update by id) | | |
| "Delete" | button | delete row + refresh list | orders (delete by id) | | |
| nav "Reports" | link | route to /reports | — | | |

## Route: <...>
| Element | Type | Expected behavior | Reads/Writes or Endpoint | Status | Evidence |

## Deferred / removed (require sign-off)
| Element | Decision (wire later / hide / remove) | Approved by | Date |
|---|---|---|---|
