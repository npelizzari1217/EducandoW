# Legajo Print Specification

## Purpose

Print-optimized CSS layout for producing physical legajo output from the student file view. Uses `@media print` rules to format all four legajo sections for paper output across ALL pedagogical levels.

## Requirements

### Requirement: Print Button

The legajo view MUST display a print button when a student is selected. The print button SHALL trigger `window.print()`. The button MUST be hidden in the printed output via `@media print` CSS.

#### Scenario: Print button triggers browser print dialog

- GIVEN a user viewing a student's legajo with data loaded
- WHEN the user clicks the print button
- THEN the browser's native print dialog opens with the legajo content formatted for paper

#### Scenario: Print button hidden when no student selected

- GIVEN a user on the `/legajos` page with no student selected
- THEN the print button MUST NOT be visible

### Requirement: Print-Optimized Layout

When printing, the system MUST apply `@media print` CSS that: hides navigation, sidebar, and interactive controls; formats the four sections sequentially for paper; uses `@page` rules for appropriate margins; and ensures text remains legible at print resolution.

#### Scenario: Navigation and sidebar hidden in print

- GIVEN a user initiates printing from the legajo page
- WHEN the print preview renders
- THEN the sidebar, top navigation, and print button MUST NOT appear

#### Scenario: All four sections render sequentially

- GIVEN a user initiates printing with a student's full legajo loaded
- WHEN the print preview renders
- THEN Datos Personales, Matrículas, Calificaciones, and Asistencia appear in order on the printed pages

#### Scenario: Empty sections are omitted in print

- GIVEN a student with no attendance records
- WHEN the print preview renders
- THEN the Asistencia section heading is omitted from the printed output — only sections with data are included

### Requirement: Print Page Formatting

Printed output MUST include a header with the student's full name and DNI. Page breaks MUST NOT split a section mid-row. The `@page` rule SHOULD set margins suitable for A4 paper.

#### Scenario: Student header appears on printed output

- GIVEN a user prints a student's legajo
- WHEN the print preview renders
- THEN the first printed page includes the student's fullName and DNI as a header

#### Scenario: Page break avoids splitting sections

- GIVEN a student with many enrollment records spanning multiple pages
- WHEN the print preview renders
- THEN the Matrículas section applies `page-break-inside: avoid` to prevent rows from being split across pages
