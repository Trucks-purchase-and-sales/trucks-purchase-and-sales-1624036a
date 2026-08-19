# Dossier AI external-processing data contract

## Purpose

The dossier audit uses the Lovable AI Gateway as an external processing boundary. Wilmet must therefore minimize what leaves the application to the fields required for technical consistency analysis.

This document defines the code-enforced contract introduced for TM-003 / issue #23. The source of truth is `src/lib/dossier-ai-payload.ts`; this document explains the policy for engineering, privacy and release review.

## Design principle

The contract is **deny by default**:

- the database query uses an explicit opportunity-column allowlist instead of `select("*")`;
- OCR queries use an explicit technical-field allowlist;
- document free-text notes are not loaded into the AI path;
- unknown database or OCR fields are excluded automatically until intentionally reviewed and added;
- bounded values are serialized as JSON so dossier data is clearly separated from prompt instructions.

Adding a new field to the external processor requires a reviewed code change to this allowlist and its tests.

## Opportunity data allowed

Only technical/condition fields required to check dossier consistency are permitted. The current contract includes categories such as:

- vehicle type/category, brand, model, version and year;
- first registration date and mileage;
- fuel, gearbox, power, Euro standard, weight/payload, axles and cabin;
- structured equipment and general-condition indicators;
- technical-inspection/maintenance status and inspection validity date;
- body type, wheelbase, suspension, tyre size and box dimensions;
- structured service-book, comfort, crane/hook/tail-lift and key-count indicators;
- structured accident/breakdown indicators.

The exact field list is `DOSSIER_AI_OPPORTUNITY_FIELDS`.

## Opportunity data prohibited

The processor does not receive direct identifiers, contact/location detail, authorization/routing identifiers, workflow messages, free-form business notes, or financial/commercial/legal attributes that are unnecessary for the technical audit. Examples deliberately excluded include:

- opportunity UUID and internal/reference number;
- partner/referrer/assigned-user/group identifiers and referral codes;
- VIN and registration number;
- city, postal code, precise location URL and on-site contact name/phone/email;
- desired, purchase, market-estimate, contract and final-sale prices;
- payment method, purchase reference and payment timestamps;
- VAT-recoverability and pledge/encumbrance status;
- handover/delivery messages;
- known-defect, repair, general-comment, special-condition and other broad free-text fields;
- embeddings and internal technical metadata;
- any future column not explicitly approved.

The previous prompt instruction to compare requested price with a benchmark was removed because raw pricing does not need to leave Wilmet for this technical dossier check.

## Document data allowed

For each checklist item the AI processor receives only:

- checklist type;
- human-readable label;
- whether the document is required;
- current status, or `absent`.

Free-form document `notes` are intentionally excluded because they can contain names, contact details, operational comments or other unnecessary personal/business data.

## OCR data allowed

OCR comparison is restricted to technical fields such as brand/model/version, first-registration date, mileage, fuel/gearbox/power, Euro standard, weight/payload, body/axle/cabin data, dimensions, suspension/tyre size and inspection-valid-until.

The processor does **not** receive OCR values for:

- VIN;
- registration number;
- city;
- postal code;
- country;
- unknown future detection fields.

The exact list is `DOSSIER_AI_OCR_FIELDS`.

## Prompt-injection boundary

Allowed values are still untrusted user/document data. The system message explicitly states that dossier values are data, never instructions, and that instructions/URLs embedded in those values must be ignored. Values are normalized, bounded and placed in a JSON data block rather than being interpolated as arbitrary field lines.

This reduces prompt-injection ambiguity but is not treated as a substitute for authorization, output validation or data minimization.

## Automated evidence

`src/lib/dossier-ai-payload.test.ts` verifies that:

- approved technical fields are retained;
- VIN/registration/contact/location/routing/referral/finance/legal/workflow/free-text secrets are absent;
- document notes cannot enter the payload;
- sensitive and unknown OCR fields are absent;
- future unknown database columns are excluded by default;
- the database/OCR allowlists themselves do not contain known prohibited columns.

## Remaining privacy release work

This code contract makes the application behavior explicit and testable. It does not by itself establish the legal basis for external AI processing, retention terms, data residency, DPA terms, or the complete subprocessor chain. Those remain part of the separate P0 legal/privacy release gate in issue #9 and the hosted-service verification work.
