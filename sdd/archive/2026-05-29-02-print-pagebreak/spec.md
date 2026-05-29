# Delta for Print Page Break

## ADDED Requirements

### Requirement: REQ-PRINT-001 Saltos de página respetan estructura visual

The print flow MUST keep page breaks aligned to table row boundaries. It MUST NOT split a row across pages.

#### Scenario: Breaks between rows

- GIVEN a printable report with a table of multiple rows
- WHEN the document spans more than one page
- THEN each page break occurs between complete rows
- AND no row is cut in the middle

#### Scenario: Single long row edge case

- GIVEN a row with content that would otherwise overflow a page
- WHEN the report is generated
- THEN the row MUST remain intact on one page or move as a whole
- AND partial row rendering MUST NOT occur

### Requirement: REQ-PRINT-002 Tablas grandes se dividen sin cortar contenido

Tables with 20 or more rows MUST paginate across multiple pages while preserving all row content.

#### Scenario: 20+ row table

- GIVEN a table with 20 or more data rows
- WHEN the PDF is generated
- THEN the output MUST span multiple pages as needed
- AND every row MUST appear completely once

#### Scenario: Large dataset edge case

- GIVEN a table with enough rows to require several pages
- WHEN pagination occurs
- THEN the document MUST remain readable
- AND no duplicated or truncated rows MUST appear

### Requirement: REQ-PRINT-003 Encabezado de tabla se repite en cada página

The table header MUST repeat on every page where the table continues.

#### Scenario: Multi-page table header

- GIVEN a table that flows onto a second page
- WHEN the second page is rendered
- THEN the table header MUST appear again at the top of that page
- AND column labels MUST remain visible

#### Scenario: First-page-only edge case

- GIVEN a table that fits on a single page
- WHEN the PDF is generated
- THEN the header MUST appear once at the top
- AND no extra header duplication MUST occur

### Requirement: REQ-PRINT-004 Preview conserva su apariencia actual

The on-screen preview MUST preserve the current visual appearance, including screen-only styling.

#### Scenario: Preview visual parity

- GIVEN the report is viewed on screen before printing
- WHEN the user opens the print preview flow
- THEN the preview MUST match the current visual layout
- AND screen styling MUST remain unchanged

#### Scenario: Visual regression edge case

- GIVEN a report using shadows, rounded corners, or colored backgrounds
- WHEN preview is rendered
- THEN those styles MUST still be visible on screen
- AND the preview MUST NOT switch to a stripped print-only look

### Requirement: REQ-PRINT-005 Footer legal aparece solo al final

The legal footer MUST appear only on the last page of the generated document.

#### Scenario: Final-page footer

- GIVEN a multi-page printable report
- WHEN the last page is rendered
- THEN the legal footer MUST appear on that final page
- AND it MUST be visible only once

#### Scenario: Intermediate-page edge case

- GIVEN a report with more than one page
- WHEN any non-final page is rendered
- THEN the legal footer MUST NOT appear on that page
- AND intermediate pages MUST remain footer-free
