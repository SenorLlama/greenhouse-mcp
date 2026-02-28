# Greenhouse Harvest MCP Server

An MCP (Model Context Protocol) server that wraps the [Greenhouse Harvest v3 API](https://harvestdocs.greenhouse.io/reference/generate-token). This allows Claude (or any MCP-compatible client) to query your Greenhouse recruiting data directly.

## Prerequisites

- Node.js 18+
- A Greenhouse API client with OAuth2 credentials (`client_id` and `client_secret`)

## Setup

### 1. Install dependencies and build

```bash
cd greenhouse-mcp
npm install
npm run build
```

### 2. Configure Claude Desktop

Add the following to your Claude Desktop MCP configuration file:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "greenhouse": {
      "command": "node",
      "args": ["/absolute/path/to/greenhouse-mcp/dist/index.js"],
      "env": {
        "GREENHOUSE_CLIENT_ID": "your_client_id_here",
        "GREENHOUSE_CLIENT_SECRET": "your_client_secret_here"
      }
    }
  }
}
```

Replace `/absolute/path/to/greenhouse-mcp` with the actual path to this directory.

### 3. Configure Claude Code (CLI)

Add to `~/.claude/claude_code_config.json` (global) or `.claude/settings.json` (project):

```json
{
  "mcpServers": {
    "greenhouse": {
      "command": "node",
      "args": ["/absolute/path/to/greenhouse-mcp/dist/index.js"],
      "env": {
        "GREENHOUSE_CLIENT_ID": "your_client_id_here",
        "GREENHOUSE_CLIENT_SECRET": "your_client_secret_here"
      }
    }
  }
}
```

### 4. Restart Claude

Restart Claude Desktop or Claude Code for the MCP server to be detected.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GREENHOUSE_CLIENT_ID` | Yes | OAuth2 client ID from Greenhouse |
| `GREENHOUSE_CLIENT_SECRET` | Yes | OAuth2 client secret from Greenhouse |

## Available Tools

| Tool | Description |
|------|-------------|
| `list_applications` | List applications with status, candidate, job, stage info |
| `get_application` | Get a single application by ID |
| `reject_application` | Reject an application with a rejection reason |
| `list_applied_candidate_tags` | List tags applied to specific candidates |
| `list_application_stages` | List which interview stage each application is in |
| `list_attachments` | List file attachments (resumes, cover letters, etc.) |
| `list_candidate_tags` | List candidate tag definitions |
| `list_candidates` | List candidate profiles |
| `get_candidate` | Get a single candidate by ID |
| `list_close_reasons` | List reasons for closing jobs |
| `list_email_templates` | List email templates (rejection emails, etc.) |
| `list_job_board_custom_locations` | List custom locations on job boards |
| `list_job_candidate_attributes` | List evaluation criteria on jobs |
| `list_job_hiring_managers` | List hiring managers assigned to jobs |
| `list_job_interview_stages` | List interview pipeline stages on jobs |
| `list_job_interviews` | List interviews configured on jobs |
| `list_job_notes` | List notes on jobs |
| `list_job_owners` | List recruiters/sourcers/coordinators on jobs |
| `list_job_post_locations` | List locations on job posts |
| `list_job_posts` | List job postings (public and internal) |
| `list_jobs` | List jobs with status, department, and office info |
| `get_job` | Get a single job by ID |
| `list_rejection_details` | List rejection details for applications |
| `list_rejection_reasons` | List predefined rejection reasons |

### Common Parameters

All list tools support:

- **`per_page`** — Results per page (1-500, default 100)
- **`cursor`** — Pagination cursor from previous response
- **`ids`** — Comma-separated IDs to filter by
- **`created_at`** — Date filter, e.g. `gte|2024-01-01T00:00:00Z`
- **`updated_at`** — Date filter, same format as `created_at`

### Resource-Specific Filters

| Tool | Additional Filters |
|------|-------------------|
| `list_applications` | `candidate_ids`, `job_ids`, `prospective_job_ids`, `job_post_ids`, `source_ids`, `referrer_ids`, `stage_ids`, `stage_name`, `status` (active/rejected/hired/converted), `prospect`, `last_activity_at`, `custom_field_option_id` |
| `list_applied_candidate_tags` | `candidate_ids`, `candidate_tag_ids` |
| `list_application_stages` | `application_ids`, `job_interview_stage_ids`, `current` |
| `list_attachments` | `candidate_ids`, `application_ids`, `type` (resume, cover_letter, take_home_test, etc.) |
| `list_candidates` | `email`, `tag`, `private`, `last_activity_at`, `custom_field_option_id` |
| `list_jobs` | `status` (open/draft/closed), `department_id`, `office_id`, `requisition_id`, `confidential`, `opened_at`, `closed_at`, `custom_field_option_id` |
| `list_job_posts` | `job_ids`, `job_board_ids`, `active`, `live`, `featured`, `internal` |
| `list_job_post_locations` | `job_post_ids`, `office_ids`, `custom_location_ids`, `type` (free_text/office/custom_list), `plain_text_location` |
| `list_job_board_custom_locations` | `greenhouse_job_board_ids`, `active` |
| `list_job_candidate_attributes` | `job_ids`, `candidate_attribute_type_ids` |
| `list_job_hiring_managers` | `job_ids`, `user_ids` |
| `list_job_interview_stages` | `job_ids`, `active` |
| `list_job_interviews` | `job_ids`, `job_interview_stage_ids`, `active`, `scheduling_type` |
| `list_job_notes` | `job_ids`, `user_ids`, `visibility` (admin_only_visible/privately_visible) |
| `list_job_owners` | `job_ids`, `user_ids`, `type` (sourcer/recruiter/coordinator) |
| `list_rejection_details` | `application_ids`, `rejection_reason_ids`, `custom_field_option_id` |
| `list_email_templates` | `email_type` (candidate_rejection, candidate_email, take_home_test_email, etc.) |
| `list_rejection_reasons` | `include_defaults` |

### Write Operations

| Tool | Required Parameters | Optional Parameters |
|------|---------------------|---------------------|
| `reject_application` | `id` (application ID), `rejection_reason_id` | `notes`, `rejection_email` (`send_email_at`, `email_template_id`, `email_from_user_id`) |

### Pagination

Results include a `next_cursor` field when more pages are available. Pass that value as the `cursor` parameter to fetch the next page. When using `cursor`, it should be the only filter parameter (per API requirements).

## Example Usage in Claude

> "Show me all open jobs in Greenhouse"

> "List the candidates created in the last 30 days"

> "What are the interview stages for job 12345?"

> "Find all resumes attached to candidate 57198627"

> "Show me the rejection reasons available"

> "Reject application 12345 with rejection reason 678"
