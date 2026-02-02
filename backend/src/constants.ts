/**
 * Workflow steps (state machine) – shared with client.
 */
export const WORKFLOW_STEPS = [
  "Auth",
  "SelectTaxYear",
  "Questionnaire",
  "Payment",
  "PersonalDetailsUploads",
  "POASignature",
  "SpouseFlow",
  "SpousePOASignature",
  "DocumentsAndData",
  "ReviewFinish",
  "SubmittedToStaff",
] as const;

export type WorkflowStep = (typeof WORKFLOW_STEPS)[number];

/**
 * Case status (Kanban columns).
 */
export const CASE_STATUSES = [
  "New",
  "InReview",
  "MissingDocs",
  "ReadyToFile",
  "Filed",
  "Done",
] as const;

export type CaseStatus = (typeof CASE_STATUSES)[number];

/**
 * Questionnaire version state.
 */
export const QUESTIONNAIRE_VERSION_STATES = ["Draft", "Published"] as const;

export type QuestionnaireVersionState = (typeof QUESTIONNAIRE_VERSION_STATES)[number];

/**
 * Requirement status.
 */
export const REQUIREMENT_STATUSES = ["missing", "uploaded", "approved", "rejected"] as const;

export type RequirementStatus = (typeof REQUIREMENT_STATUSES)[number];

/**
 * User roles.
 */
export const USER_ROLES = ["user", "admin", "employee"] as const;

export type UserRole = (typeof USER_ROLES)[number];
