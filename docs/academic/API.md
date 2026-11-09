# Academic API — draft

OpenAPI UI: `http://localhost:8011/docs`. Prefix: `/api/v1`. Login uses form fields `username` and `password`. Access and refresh tokens are HttpOnly cookies; state-changing requests are subject to an origin guard. Logout clears cookies.

| API | Purpose |
| --- | --- |
| `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`; `GET /auth/me` | Registration and session |
| `GET/PUT /profile/me`, `GET /profile/{id}`, `GET /directory/` | Profile and people |
| `GET/POST /projects`, `GET/PUT/DELETE /projects/{id}` | Catalog and project management |
| `GET /projects/recommended`, `/projects/saved`, `/projects/user/{id}` | Recommendations, saved items and user projects |
| `POST /projects/{id}/apply`, `GET /projects/{id}/applications`, `/projects/{id}/candidates` | Applications and candidates |
| `POST /interactions`, `GET /interactions/me`, `/interactions/state/{id}` | Events, history and saved state |

`PUT` applies only supplied project fields. List responses include `items`, `total`, `page`, `pages` and `limit`. Catalog sorting accepts `latest`, `match`, `popular`; text search is word-based. A client-generated UUID identifies each interaction. A matching retry returns 200; reuse with different content returns 409. Only the server emits APPLY. RATE requires an integer 1–5; other events prohibit rating. Errors include 401 for missing authentication, 403 for forbidden operations, 404 for unavailable records, 409 for duplicates and 422 for invalid input.

The API and its response schemas still need full contract and OpenAPI verification against the specification.
