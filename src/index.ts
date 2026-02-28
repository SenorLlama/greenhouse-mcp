#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { configure, apiGet, apiGetWithCursor, apiPost, type ApiResponse } from "./client.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const clientId = process.env.GREENHOUSE_CLIENT_ID;
const clientSecret = process.env.GREENHOUSE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error(
    "Error: GREENHOUSE_CLIENT_ID and GREENHOUSE_CLIENT_SECRET environment variables are required."
  );
  process.exit(1);
}

configure(clientId, clientSecret);

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------

const server = new McpServer({
  name: "greenhouse-harvest",
  version: "1.0.0",
});

// ---------------------------------------------------------------------------
// Helper: format API response as MCP tool result
// ---------------------------------------------------------------------------

function formatResult<T>(response: ApiResponse<T>): {
  content: { type: "text"; text: string }[];
} {
  const result: Record<string, unknown> = { data: response.data };
  if (response.nextCursor) {
    result.next_cursor = response.nextCursor;
    result._pagination_note =
      "Pass next_cursor value as the 'cursor' parameter to fetch the next page.";
  }
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
  };
}

// ---------------------------------------------------------------------------
// Common parameter schemas
// ---------------------------------------------------------------------------

const paginationParams = {
  per_page: z
    .number()
    .min(1)
    .max(500)
    .optional()
    .describe("Results per page (1-500, default 100)"),
  cursor: z
    .string()
    .optional()
    .describe(
      "Pagination cursor from a previous response. When provided, must be the only filter parameter."
    ),
};

const dateFilterParams = {
  created_at: z
    .string()
    .optional()
    .describe(
      "Filter by creation date. Format: operator|ISO8601 (e.g. gte|2024-01-01T00:00:00Z). Operators: gte, lte, gt, lt"
    ),
  updated_at: z
    .string()
    .optional()
    .describe(
      "Filter by update date. Format: operator|ISO8601 (e.g. gte|2024-01-01T00:00:00Z). Operators: gte, lte, gt, lt"
    ),
};

// ---------------------------------------------------------------------------
// Helper: route through cursor vs normal pagination
// ---------------------------------------------------------------------------

async function listEndpoint<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined>,
  cursor?: string
): Promise<ApiResponse<T>> {
  if (cursor) {
    return apiGetWithCursor<T>(path, cursor);
  }
  return apiGet<T>(path, params);
}

// ---------------------------------------------------------------------------
// Tools
// ---------------------------------------------------------------------------

// 1. Applications
server.tool(
  "list_applications",
  "List applications in Greenhouse. Returns application details including status, candidate, job, stage, and answers. Status can be active, rejected, hired, or converted.",
  {
    ...paginationParams,
    ...dateFilterParams,
    ids: z.string().optional().describe("Comma-separated application IDs to filter by"),
    candidate_ids: z
      .string()
      .optional()
      .describe("Comma-separated candidate IDs to filter by"),
    job_ids: z
      .string()
      .optional()
      .describe("Comma-separated job IDs to filter by"),
    prospective_job_ids: z
      .string()
      .optional()
      .describe("Comma-separated prospective job IDs to filter by"),
    job_post_ids: z
      .string()
      .optional()
      .describe("Comma-separated job post IDs to filter by"),
    source_ids: z
      .string()
      .optional()
      .describe("Comma-separated source IDs to filter by"),
    referrer_ids: z
      .string()
      .optional()
      .describe("Comma-separated referrer IDs to filter by"),
    stage_ids: z
      .string()
      .optional()
      .describe("Comma-separated interview stage IDs to filter by"),
    stage_name: z
      .string()
      .optional()
      .describe("Filter applications by current stage name (exact match)"),
    status: z
      .enum(["active", "rejected", "hired", "converted"])
      .optional()
      .describe("Filter by application status"),
    prospect: z
      .boolean()
      .optional()
      .describe("Filter by prospect status (true for prospects, false for applicants)"),
    last_activity_at: z
      .string()
      .optional()
      .describe(
        "Filter by last activity date. Format: operator|ISO8601 (e.g. gte|2024-01-01T00:00:00Z). Operators: gte, lte, gt, lt"
      ),
    custom_field_option_id: z
      .number()
      .optional()
      .describe("Filter by custom field option ID"),
  },
  async (params) => {
    const { cursor, ...rest } = params;
    const response = await listEndpoint("/applications", rest, cursor);
    return formatResult(response);
  }
);

server.tool(
  "get_application",
  "Get a single application by ID. Returns full application details including status, candidate, job, stage, and answers.",
  {
    id: z.number().describe("The application ID"),
  },
  async ({ id }) => {
    const response = await apiGet(`/applications/${id}`);
    return formatResult(response);
  }
);

server.tool(
  "reject_application",
  "Reject an application in Greenhouse. Requires the application ID and a rejection reason ID. Optionally include notes and rejection email configuration.",
  {
    id: z.number().describe("The application ID to reject"),
    rejection_reason_id: z
      .number()
      .describe("The ID of the rejection reason (use list_rejection_reasons to find valid IDs)"),
    notes: z.string().optional().describe("Additional notes about the rejection"),
    rejection_email: z
      .object({
        send_email_at: z
          .string()
          .optional()
          .describe("Scheduled time to send rejection email (ISO 8601 datetime)"),
        email_template_id: z
          .number()
          .optional()
          .describe("Template ID for the rejection email"),
        email_from_user_id: z
          .number()
          .optional()
          .describe("User ID to send the rejection email from"),
      })
      .optional()
      .describe("Optional rejection email configuration"),
  },
  async ({ id, ...body }) => {
    const response = await apiPost(`/applications/${id}/reject`, body);
    return formatResult(response);
  }
);

// 2. Applied Candidate Tags
server.tool(
  "list_applied_candidate_tags",
  "List applied candidate tags in Greenhouse. Shows which tags have been applied to which candidates.",
  {
    ...paginationParams,
    ...dateFilterParams,
    ids: z.string().optional().describe("Comma-separated applied candidate tag IDs to filter by"),
    candidate_ids: z
      .string()
      .optional()
      .describe("Comma-separated candidate IDs to filter by"),
    candidate_tag_ids: z
      .string()
      .optional()
      .describe("Comma-separated candidate tag IDs to filter by"),
  },
  async (params) => {
    const { cursor, ...rest } = params;
    const response = await listEndpoint("/applied_candidate_tags", rest, cursor);
    return formatResult(response);
  }
);

// 2. Application Stages
server.tool(
  "list_application_stages",
  "List application stages from Greenhouse. Shows which interview stage each application is in, when they entered/exited, and whether it's their current stage.",
  {
    ...paginationParams,
    ...dateFilterParams,
    ids: z.string().optional().describe("Comma-separated application stage IDs to filter by"),
    application_ids: z
      .string()
      .optional()
      .describe("Comma-separated application IDs to filter by"),
    job_interview_stage_ids: z
      .string()
      .optional()
      .describe("Comma-separated job interview stage IDs to filter by"),
    current: z
      .boolean()
      .optional()
      .describe("Filter to only current (true) or non-current (false) stages"),
  },
  async (params) => {
    const { cursor, ...rest } = params;
    const response = await listEndpoint("/application_stages", rest, cursor);
    return formatResult(response);
  }
);

// 3. Attachments
server.tool(
  "list_attachments",
  "List file attachments in Greenhouse. Returns attachment metadata including filename, type (resume, cover_letter, etc.), and a signed download URL. URLs expire after 7 days.",
  {
    ...paginationParams,
    ...dateFilterParams,
    ids: z.string().optional().describe("Comma-separated attachment IDs to filter by"),
    candidate_ids: z
      .string()
      .optional()
      .describe("Comma-separated candidate IDs to filter by"),
    application_ids: z
      .string()
      .optional()
      .describe("Comma-separated application IDs to filter by"),
    type: z
      .enum([
        "resume",
        "cover_letter",
        "take_home_test",
        "offer_packet",
        "offer_letter",
        "signed_offer_letter",
        "other",
        "form_attachment",
        "midfunnel_agreement",
        "automated_agreement",
      ])
      .optional()
      .describe("Filter by attachment type"),
  },
  async (params) => {
    const { cursor, ...rest } = params;
    const response = await listEndpoint("/attachments", rest, cursor);
    return formatResult(response);
  }
);

// 4. Candidate Tags
server.tool(
  "list_candidate_tags",
  "List all candidate tags defined in Greenhouse. Tags are labels that can be applied to candidates for categorization.",
  {
    ...paginationParams,
    ...dateFilterParams,
    ids: z.string().optional().describe("Comma-separated candidate tag IDs to filter by"),
  },
  async (params) => {
    const { cursor, ...rest } = params;
    const response = await listEndpoint("/candidate_tags", rest, cursor);
    return formatResult(response);
  }
);

// 5. Candidates
server.tool(
  "list_candidates",
  "List candidates in Greenhouse. Returns candidate profiles including name, contact info, tags, and custom fields.",
  {
    ...paginationParams,
    ...dateFilterParams,
    ids: z.string().optional().describe("Comma-separated candidate IDs to filter by"),
    last_activity_at: z
      .string()
      .optional()
      .describe(
        "Filter by last activity date. Format: operator|ISO8601 (e.g. gte|2024-01-01T00:00:00Z). Operators: gte, lte, gt, lt"
      ),
    custom_field_option_id: z
      .number()
      .optional()
      .describe("Filter by custom field option ID"),
    private: z.boolean().optional().describe("Filter by private/confidential status"),
    email: z.string().optional().describe("Filter by email address"),
    tag: z.string().optional().describe("Filter by candidate tag name"),
  },
  async (params) => {
    const { cursor, ...rest } = params;
    const response = await listEndpoint("/candidates", rest, cursor);
    return formatResult(response);
  }
);

server.tool(
  "get_candidate",
  "Get a single candidate by ID. Returns full candidate profile including name, contact info, tags, and custom fields.",
  {
    id: z.number().describe("The candidate ID"),
  },
  async ({ id }) => {
    const response = await apiGet(`/candidates/${id}`);
    return formatResult(response);
  }
);

// 6. Close Reasons
server.tool(
  "list_close_reasons",
  "List all close reasons in Greenhouse. Close reasons are used when closing a job to indicate why it was closed.",
  {
    ...paginationParams,
    ...dateFilterParams,
    ids: z.string().optional().describe("Comma-separated close reason IDs to filter by"),
  },
  async (params) => {
    const { cursor, ...rest } = params;
    const response = await listEndpoint("/close_reasons", rest, cursor);
    return formatResult(response);
  }
);

// 7. Email Templates
server.tool(
  "list_email_templates",
  "List email templates in Greenhouse. Returns template details including name, subject, body, and email type.",
  {
    ...paginationParams,
    ...dateFilterParams,
    ids: z.string().optional().describe("Comma-separated email template IDs to filter by"),
    email_type: z
      .string()
      .optional()
      .describe(
        "Filter by email template type (e.g. candidate_rejection, candidate_email, take_home_test_email, scorecard_reminder, etc.)"
      ),
  },
  async (params) => {
    const { cursor, ...rest } = params;
    const response = await listEndpoint("/email_templates", rest, cursor);
    return formatResult(response);
  }
);

// 8. Job Board Custom Locations
server.tool(
  "list_job_board_custom_locations",
  "List custom locations defined on job boards in Greenhouse.",
  {
    ...paginationParams,
    ...dateFilterParams,
    ids: z.string().optional().describe("Comma-separated location IDs to filter by"),
    greenhouse_job_board_ids: z
      .string()
      .optional()
      .describe("Comma-separated job board IDs to filter by"),
    active: z.boolean().optional().describe("Filter by active status"),
  },
  async (params) => {
    const { cursor, ...rest } = params;
    const response = await listEndpoint("/job_board_custom_locations", rest, cursor);
    return formatResult(response);
  }
);

// 8. Job Candidate Attributes
server.tool(
  "list_job_candidate_attributes",
  "List candidate attributes configured on jobs in Greenhouse. These define the evaluation criteria for candidates on a specific job.",
  {
    ...paginationParams,
    ...dateFilterParams,
    ids: z.string().optional().describe("Comma-separated attribute IDs to filter by"),
    job_ids: z.string().optional().describe("Comma-separated job IDs to filter by"),
    candidate_attribute_type_ids: z
      .string()
      .optional()
      .describe("Comma-separated candidate attribute type IDs to filter by"),
  },
  async (params) => {
    const { cursor, ...rest } = params;
    const response = await listEndpoint("/job_candidate_attributes", rest, cursor);
    return formatResult(response);
  }
);

// 9. Job Hiring Managers
server.tool(
  "list_job_hiring_managers",
  "List hiring managers assigned to jobs in Greenhouse.",
  {
    ...paginationParams,
    ...dateFilterParams,
    ids: z.string().optional().describe("Comma-separated hiring manager assignment IDs to filter by"),
    job_ids: z.string().optional().describe("Comma-separated job IDs to filter by"),
    user_ids: z.string().optional().describe("Comma-separated user IDs to filter by"),
  },
  async (params) => {
    const { cursor, ...rest } = params;
    const response = await listEndpoint("/job_hiring_managers", rest, cursor);
    return formatResult(response);
  }
);

// 10. Job Interview Stages
server.tool(
  "list_job_interview_stages",
  "List interview stages (pipeline stages) configured on jobs in Greenhouse. Shows the interview pipeline structure.",
  {
    ...paginationParams,
    ...dateFilterParams,
    ids: z.string().optional().describe("Comma-separated stage IDs to filter by"),
    job_ids: z.string().optional().describe("Comma-separated job IDs to filter by"),
    active: z.boolean().optional().describe("Filter by active status"),
  },
  async (params) => {
    const { cursor, ...rest } = params;
    const response = await listEndpoint("/job_interview_stages", rest, cursor);
    return formatResult(response);
  }
);

// 11. Job Interviews
server.tool(
  "list_job_interviews",
  "List interviews configured on jobs in Greenhouse. Shows interview details including scheduling type, duration, and instructions.",
  {
    ...paginationParams,
    ...dateFilterParams,
    ids: z.string().optional().describe("Comma-separated interview IDs to filter by"),
    job_ids: z.string().optional().describe("Comma-separated job IDs to filter by"),
    job_interview_stage_ids: z
      .string()
      .optional()
      .describe("Comma-separated interview stage IDs to filter by"),
    active: z.boolean().optional().describe("Filter by active status"),
    scheduling_type: z
      .enum(["none", "needs_scheduling", "take_home_test", "offer"])
      .optional()
      .describe("Filter by scheduling type"),
  },
  async (params) => {
    const { cursor, ...rest } = params;
    const response = await listEndpoint("/job_interviews", rest, cursor);
    return formatResult(response);
  }
);

// 12. Job Notes
server.tool(
  "list_job_notes",
  "List notes on jobs in Greenhouse. Notes contain comments/observations about jobs made by team members.",
  {
    ...paginationParams,
    ...dateFilterParams,
    ids: z.string().optional().describe("Comma-separated note IDs to filter by"),
    job_ids: z.string().optional().describe("Comma-separated job IDs to filter by"),
    user_ids: z.string().optional().describe("Comma-separated user IDs to filter by (note authors)"),
    visibility: z
      .enum(["admin_only_visible", "privately_visible"])
      .optional()
      .describe("Filter by visibility level"),
  },
  async (params) => {
    const { cursor, ...rest } = params;
    const response = await listEndpoint("/job_notes", rest, cursor);
    return formatResult(response);
  }
);

// 13. Job Owners
server.tool(
  "list_job_owners",
  "List owners (recruiters, sourcers, coordinators) assigned to jobs in Greenhouse.",
  {
    ...paginationParams,
    ...dateFilterParams,
    ids: z.string().optional().describe("Comma-separated owner assignment IDs to filter by"),
    job_ids: z.string().optional().describe("Comma-separated job IDs to filter by"),
    user_ids: z.string().optional().describe("Comma-separated user IDs to filter by"),
    type: z
      .enum(["sourcer", "recruiter", "coordinator"])
      .optional()
      .describe("Filter by owner type"),
  },
  async (params) => {
    const { cursor, ...rest } = params;
    const response = await listEndpoint("/job_owners", rest, cursor);
    return formatResult(response);
  }
);

// 14. Job Post Locations
server.tool(
  "list_job_post_locations",
  "List locations associated with job posts in Greenhouse.",
  {
    ...paginationParams,
    ...dateFilterParams,
    ids: z.string().optional().describe("Comma-separated location IDs to filter by"),
    job_post_ids: z.string().optional().describe("Comma-separated job post IDs to filter by"),
    office_ids: z.string().optional().describe("Comma-separated office IDs to filter by"),
    custom_location_ids: z
      .string()
      .optional()
      .describe("Comma-separated custom location IDs to filter by"),
    type: z
      .enum(["free_text", "office", "custom_list"])
      .optional()
      .describe("Filter by location type"),
    plain_text_location: z
      .string()
      .optional()
      .describe("Filter by plain text location value"),
  },
  async (params) => {
    const { cursor, ...rest } = params;
    const response = await listEndpoint("/job_post_locations", rest, cursor);
    return formatResult(response);
  }
);

// 15. Job Posts
server.tool(
  "list_job_posts",
  "List job posts in Greenhouse. Job posts are the public or internal postings of a job, including title, content, and questions.",
  {
    ...paginationParams,
    ...dateFilterParams,
    ids: z.string().optional().describe("Comma-separated job post IDs to filter by"),
    job_ids: z.string().optional().describe("Comma-separated job IDs to filter by"),
    job_board_ids: z.string().optional().describe("Comma-separated job board IDs to filter by"),
    active: z.boolean().optional().describe("Filter by active status"),
    live: z.boolean().optional().describe("Filter by live status (live post on a live job board)"),
    featured: z.boolean().optional().describe("Filter by featured status"),
    internal: z.boolean().optional().describe("Filter by internal posting status"),
  },
  async (params) => {
    const { cursor, ...rest } = params;
    const response = await listEndpoint("/job_posts", rest, cursor);
    return formatResult(response);
  }
);

// 16. Jobs
server.tool(
  "list_jobs",
  "List jobs in Greenhouse. Returns job details including name, status, department, offices, and custom fields.",
  {
    ...paginationParams,
    ...dateFilterParams,
    ids: z.string().optional().describe("Comma-separated job IDs to filter by"),
    status: z
      .enum(["open", "draft", "closed"])
      .optional()
      .describe("Filter by job status"),
    department_id: z.number().optional().describe("Filter by department ID"),
    office_id: z.number().optional().describe("Filter by office ID"),
    requisition_id: z.string().optional().describe("Filter by requisition ID"),
    confidential: z.boolean().optional().describe("Filter by confidential status"),
    custom_field_option_id: z
      .number()
      .optional()
      .describe("Filter by custom field option ID"),
    opened_at: z
      .string()
      .optional()
      .describe(
        "Filter by job open date. Format: operator|ISO8601 (e.g. gte|2024-01-01T00:00:00Z). Operators: gte, lte, gt, lt"
      ),
    closed_at: z
      .string()
      .optional()
      .describe(
        "Filter by job close date. Format: operator|ISO8601 (e.g. gte|2024-01-01T00:00:00Z). Operators: gte, lte, gt, lt"
      ),
  },
  async (params) => {
    const { cursor, ...rest } = params;
    const response = await listEndpoint("/jobs", rest, cursor);
    return formatResult(response);
  }
);

server.tool(
  "get_job",
  "Get a single job by ID. Returns full job details including name, status, department, offices, and custom fields.",
  {
    id: z.number().describe("The job ID"),
  },
  async ({ id }) => {
    const response = await apiGet(`/jobs/${id}`);
    return formatResult(response);
  }
);

// 17. Rejection Details
server.tool(
  "list_rejection_details",
  "List rejection details for applications in Greenhouse. Shows who rejected, the reason, and any rejection notes.",
  {
    ...paginationParams,
    ...dateFilterParams,
    ids: z.string().optional().describe("Comma-separated rejection detail IDs to filter by"),
    application_ids: z
      .string()
      .optional()
      .describe("Comma-separated application IDs to filter by"),
    rejection_reason_ids: z
      .string()
      .optional()
      .describe("Comma-separated rejection reason IDs to filter by"),
    custom_field_option_id: z
      .number()
      .optional()
      .describe("Filter by custom field option ID"),
  },
  async (params) => {
    const { cursor, ...rest } = params;
    const response = await listEndpoint("/rejection_details", rest, cursor);
    return formatResult(response);
  }
);

// 18. Rejection Reasons
server.tool(
  "list_rejection_reasons",
  "List all rejection reasons in Greenhouse. These are the predefined reasons available when rejecting candidates.",
  {
    ...paginationParams,
    ...dateFilterParams,
    ids: z.string().optional().describe("Comma-separated rejection reason IDs to filter by"),
    include_defaults: z
      .boolean()
      .optional()
      .describe("Include default rejection reasons"),
  },
  async (params) => {
    const { cursor, ...rest } = params;
    const response = await listEndpoint("/rejection_reasons", rest, cursor);
    return formatResult(response);
  }
);

// ---------------------------------------------------------------------------
// Start server
// ---------------------------------------------------------------------------

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
