# Atlas OIDC & JWT Playground

A single static HTML page (`index.html`) — no build step, no backend, no
dependencies. Open it in a browser and everything runs client-side.

## Features

### JWT Decoder (like jwt.io)
- Paste a JWT → it splits into `header.payload.signature` (colorized) and
  base64url-decodes the header and payload to pretty JSON.
- A **claims table** annotates each claim with its meaning (RFC 7519 standard
  claims plus common OIDC and Atlas claims: `org_id`, `org_role`, `public_metadata`, …).
- `exp` / `nbf` / `iat` are rendered as ISO timestamps with a live **countdown**,
  and a status pill shows whether the token is expired / not-yet-valid.
- Signatures are **not** verified (that requires the issuer's JWKS public key) — the
  page says so explicitly.

### OIDC Discovery Explorer
- Enter an Atlas issuer (or any OIDC provider) → fetches
  `{issuer}/.well-known/openid-configuration` and the JWKS it points to, and lists
  the endpoints and supported scopes / response types / PKCE methods.
- **Authorize URL builder**: enter `client_id`, `redirect_uri`, `scope`,
  `response_type`, toggle **PKCE (S256)** → generates a `code_verifier` +
  `code_challenge` (RFC 7636, via Web Crypto) and assembles the full authorize URL
  with a random `state`.

### Privacy / network
Pure client-side. The **only** network request the page makes is to the issuer you
type into the discovery box (and its `jwks_uri`). Pasted tokens never leave the tab.
Theme-aware (auto/light/dark) with a toggle; preference stored in `localStorage`.

## Run

Just open `index.html` in a browser. To serve it (some browsers block `fetch`
from `file:`):

```bash
cd tools/playground && python3 -m http.server 8000
# then open http://localhost:8000/index.html
```

## Verify

```bash
node tools/playground/verify.mjs    # or: pnpm verify:dx
```

The test extracts the page's **pure** helper functions verbatim (the block between
the `PURE-START` / `PURE-END` markers in `index.html`) and runs them in Node, so the
test cannot drift from the shipped page. It asserts the decoder splits and
base64url-decodes a sample Atlas token correctly (header `alg`/`kid`, payload claims),
round-trips UTF-8, rejects malformed tokens, resolves claim meanings, and that the
PKCE S256 challenge is a valid 43-char base64url digest.
