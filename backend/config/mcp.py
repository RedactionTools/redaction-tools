"""The staff MCP surface.

A second front door onto the same catalog as `config/api.py`, for Claude rather
than for the frontend. This module composes and does not implement: each app
declares its own tools in its `mcp.py` and they are attached here, so this file
stays a manifest.

Nothing here reaches `openapi.json`. `make backend-schema` exports
`config.api.api` only, so the MCP server is outside the generated-contract chain
and the Orval client never sees it.
"""

from django_mcpz.server import MCPServer

from apps.accounts.mcp_auth import staff_auth
from apps.catalog.mcp import register as register_catalog

INSTRUCTIONS = """\
Staff console for the redaction-tools catalog. "Tool" here means a product
listed in the directory, not an MCP tool.

Work slug-first: catalog_list_tools to find a listing, catalog_get_tool to read
it, then catalog_update_tool, catalog_update_plan or catalog_set_plan_price to
change it.

A new tier is three or four calls, not one, because a plan, its caps and each
of its figures are separate records with separate provenance:

  1. catalog_create_plan       - the tier itself
  2. catalog_set_plan_limit    - each published cap (a page allowance is what
                                 makes an overage rate apply)
  3. catalog_set_plan_price    - the fee
  4. catalog_set_plan_price    - again with is_overage, for a metered rate

catalog_create_plan returns has_pricing_position. While it is false the plan is
invisible to the public catalog, so a tier left there is unfinished work.

Every write is live and audited. There is no draft or review step. A listing
edit is recorded as an already-applied revision; a price opens a new row and
closes the one it supersedes, so the published history stays intact.

catalog_get_tool returns `listability_reasons`: the list of what stands between
a listing and being a public page. Work it down, then read it again.

description_md must be our own editorial. Vendor copy never counts toward the
400-character minimum - put that in vendor_copy_md.

Never invent a figure. Every price must come from the vendor's own page, and
source_evidence_url should point at it.
"""

server = MCPServer(
    name="redaction-tools-staff",
    title="redaction-tools (staff)",
    version="1.0.0",
    description="Read and edit the redaction-tools catalog: listings, plans and prices.",
    website_url="https://redaction-tools.com",
    instructions=INSTRUCTIONS,
    auth=staff_auth,
)

register_catalog(server)
