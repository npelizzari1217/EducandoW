# API Adapter Layer Specification

## Purpose

Establishes an adapter layer that transforms raw API responses into domain-typed objects before they reach components, so components are decoupled from the API envelope shape.

## Requirements

### Requirement: Adapter Functions for API Responses

The system MUST provide transformer functions in `web/src/api/adapters/` that unwrap API envelope responses into typed domain objects. Components and hooks MUST consume the adapted output — NOT the raw API response shape. The adapter layer MUST be the only place in the web package that references raw API envelope fields (e.g., `data.data`, `data.items`).

#### Scenario: List response unwrapped before reaching component

- GIVEN an API endpoint returns `{ data: { data: [...items], total: N } }`
- WHEN a hook fetches and passes data to a component
- THEN the component receives a plain array of domain-typed items
- AND the component has no reference to `data.data` or envelope wrappers

#### Scenario: Single-item response unwrapped before reaching component

- GIVEN an API endpoint returns `{ data: { ...item } }`
- WHEN a hook fetches and passes data to a component
- THEN the component receives the typed item directly
- AND the component has no reference to `data.data`

#### Scenario: Adapter returns typed empty array on empty list

- GIVEN an API returns `{ data: { data: [], total: 0 } }`
- WHEN the adapter processes the response
- THEN the hook provides `[]` (empty typed array) to the component
- AND no runtime error occurs

#### Scenario: Components import from adapters, not from raw API client

- GIVEN a component or hook needs to display a list of academic cycles
- WHEN the source file is inspected
- THEN it imports from `web/src/api/adapters/` or a hook that wraps an adapter
- AND no direct access to raw response envelope fields appears in the component
