# Spec: Máquina de estados de Ingresante

**RFC 2119 keywords apply throughout this document.**

## Overview

The Ingresante state machine MUST be enforced at the domain/API layer, not only in the UI.
Invalid transitions MUST be rejected by the API with a descriptive error message indicating
which transition was attempted and why it is not allowed.

## State Table

| State | Terminal |
|-------|----------|
| INSCRIPTO | No |
| PAGO_MATRICULA | No |
| ACEPTADO | No |
| INGRESO | Yes |
| NO_INGRESARA | Yes |

## Transition Map

| From | Allowed → To |
|------|-------------|
| INSCRIPTO | PAGO_MATRICULA, NO_INGRESARA |
| PAGO_MATRICULA | ACEPTADO, NO_INGRESARA |
| ACEPTADO | NO_INGRESARA (see note on INGRESO below) |
| INGRESO | (none — terminal) |
| NO_INGRESARA | (none — terminal) |

> INGRESO is reachable ONLY via the PromoteIngresante operation (see spec 03-promote-transactional).
> A direct status-update request targeting INGRESO MUST be rejected regardless of current state.

## Rules

1. **Forward-only**: The API MUST NOT allow backward transitions (e.g., PAGO_MATRICULA → INSCRIPTO).
2. **No skipping**: The API MUST NOT allow skipping states (e.g., INSCRIPTO → ACEPTADO).
3. **Terminal immutability**: Once an ingresante reaches INGRESO or NO_INGRESARA, its state MUST NOT be changed by any operation.
4. **INGRESO via promote only**: Any direct write of INGRESO through the status-update endpoint MUST be rejected.
5. **NO_INGRESARA availability**: NO_INGRESARA MUST be reachable from any non-terminal state (INSCRIPTO, PAGO_MATRICULA, ACEPTADO) via a standard status update.
6. **Non-retroactive (D2)**: This validation applies ONLY to transitions requested after the change is deployed. Existing ingresante records whose state was set before deployment are NOT corrected or flagged retroactively. Future transitions on those records MUST follow these rules starting from their current state.

## Acceptance Scenarios

### SC-SM-01 — Valid forward transition (INSCRIPTO → PAGO_MATRICULA)
**Given** an ingresante currently in state INSCRIPTO  
**When** a status-update request to PAGO_MATRICULA is submitted  
**Then** the request is accepted  
**And** the ingresante state becomes PAGO_MATRICULA

### SC-SM-02 — Skip transition rejected (INSCRIPTO → ACEPTADO)
**Given** an ingresante currently in state INSCRIPTO  
**When** a status-update request to ACEPTADO is submitted  
**Then** the API returns a 4xx error  
**And** the error message identifies the transition as invalid  
**And** the ingresante state remains INSCRIPTO

### SC-SM-03 — Backward transition rejected (PAGO_MATRICULA → INSCRIPTO)
**Given** an ingresante currently in state PAGO_MATRICULA  
**When** a status-update request to INSCRIPTO is submitted  
**Then** the API returns a 4xx error  
**And** the error message identifies the transition as invalid  
**And** the ingresante state remains PAGO_MATRICULA

### SC-SM-04 — Terminal state INGRESO is immutable
**Given** an ingresante currently in state INGRESO  
**When** any status-update request is submitted (to any state)  
**Then** the API returns a 4xx error  
**And** the error message indicates the state is terminal  
**And** the ingresante state remains INGRESO

### SC-SM-05 — Terminal state NO_INGRESARA is immutable
**Given** an ingresante currently in state NO_INGRESARA  
**When** any status-update request is submitted (to any state)  
**Then** the API returns a 4xx error  
**And** the error message indicates the state is terminal  
**And** the ingresante state remains NO_INGRESARA

### SC-SM-06 — NO_INGRESARA from INSCRIPTO
**Given** an ingresante currently in state INSCRIPTO  
**When** a status-update request to NO_INGRESARA is submitted  
**Then** the request is accepted  
**And** the ingresante state becomes NO_INGRESARA

### SC-SM-07 — NO_INGRESARA from PAGO_MATRICULA
**Given** an ingresante currently in state PAGO_MATRICULA  
**When** a status-update request to NO_INGRESARA is submitted  
**Then** the request is accepted  
**And** the ingresante state becomes NO_INGRESARA

### SC-SM-08 — NO_INGRESARA from ACEPTADO
**Given** an ingresante currently in state ACEPTADO  
**When** a status-update request to NO_INGRESARA is submitted  
**Then** the request is accepted  
**And** the ingresante state becomes NO_INGRESARA

### SC-SM-09 — Direct write to INGRESO via status-update rejected
**Given** an ingresante currently in state ACEPTADO  
**When** a status-update request directly to INGRESO is submitted (not via promote)  
**Then** the API returns a 4xx error  
**And** the ingresante state remains ACEPTADO

### SC-SM-10 — Legacy record: future transitions follow rules from current state (D2)
**Given** an ingresante whose current state is ACEPTADO but which reached that state
before validation was active (no PAGO_MATRICULA record in its history)  
**When** a status-update request to NO_INGRESARA is submitted  
**Then** the request is accepted (ACEPTADO → NO_INGRESARA is a valid transition)  
**And** no retroactive error or correction is triggered for the legacy state
