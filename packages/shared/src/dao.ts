/** Shared DAO-related contracts (placeholders for API / persistence shapes). */

export type DaoProposalStatus = "draft" | "active" | "passed" | "rejected";

export interface DaoProposal {
  id: string;
  title: string;
  status: DaoProposalStatus;
}
