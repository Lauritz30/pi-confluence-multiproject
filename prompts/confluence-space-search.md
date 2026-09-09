Search and summarize information for a specific Confluence space.

Steps:
1. Build a CQL query constrained to the requested space key.
2. Use `confluence_search_content` to retrieve top relevant pages.
3. Read key pages with `confluence_get_page`.
4. Return a short, source-linked summary.
