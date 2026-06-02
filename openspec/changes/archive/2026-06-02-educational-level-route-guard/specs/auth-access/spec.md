# Delta for Auth Access

## ADDED Requirements

_(No new requirements — one new scenario is added to an existing requirement below.)_

## MODIFIED Requirements

### Requirement: JWT Carries levels Array

The JWT payload MUST include a `levels` field typed as `number[]` (array of composite codes, each computed as `level * 10 + modality`). The previous scalar `level: number` field MUST NOT be present in newly issued tokens. The `AuthenticatedUser` domain object MUST expose `levels: number[]` instead of `level: number`. The `levels` array MUST be preserved across token refreshes — `RefreshTokenUseCase` MUST include `levels` and `userLevels` in every newly signed JWT.

(Previously: requirement did not specify behavior for refresh tokens; levels were silently dropped on refresh.)

#### Scenario: Login returns JWT with levels array

- GIVEN a user with `user_levels` [(level=2, modality=0), (level=3, modality=1)]
- WHEN the user authenticates via `POST /v1/auth/login`
- THEN the issued JWT contains `levels: [20, 31]` and does NOT contain a `level` scalar field

#### Scenario: User with no levels gets empty array in JWT

- GIVEN a user with no `user_levels` rows
- WHEN the user authenticates
- THEN the issued JWT contains `levels: []`

#### Scenario: Auth guard extracts levels into AuthenticatedUser

- GIVEN a valid JWT with `levels: [20, 31]`
- WHEN the auth guard processes an incoming request
- THEN `req.user.levels` equals `[20, 31]`

#### Scenario: GET /auth/me response includes levels array

- GIVEN an authenticated user with `user_levels` [(level=1, modality=0)]
- WHEN `GET /v1/auth/me` is called
- THEN the response includes `levels: [10]` and `userLevels: [{ level: 1, modality: 0 }]`
- AND the response does NOT include a scalar `level` field

#### Scenario: Refresh token preserves levels array

- GIVEN a valid JWT with `levels: [20, 31]`
- WHEN the refresh token endpoint is called
- THEN the newly issued JWT also contains `levels: [20, 31]`
