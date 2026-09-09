# pi-confluence-multiproject

Confluence Cloud integration for the [pi coding agent](https://pi.dev) — page retrieval, CQL search, page hierarchy, comments, and safety-gated write actions.

> Status: npm-installable pi package (TypeScript, loaded natively by pi — no build step).

## Installation

From npm:

```bash
pi install npm:pi-confluence-multiproject
```

From git:

```bash
pi install git:github.com/Lauritz30/pi-confluence-multiproject
```

For a one-off session: `pi -e npm:pi-confluence-multiproject`.

## Quick Start

1. Generate an API token at https://id.atlassian.com/manage-profile/security/api-tokens.
2. Create `~/.pi/agent/pi-confluence-multiproject.json` with your site, email, and API token.
3. Run `/confluence-doctor` to verify configuration and connectivity.

### Example configuration

```json
{
  "defaultSite": "acme",
  "safetyLevel": "confirm",
  "sites": [
    {
      "name": "acme",
      "url": "https://acme.atlassian.net",
      "email": "you@acme.com",
      "apiToken": "your-api-token"
    }
  ]
}
```

### Multi-site

```json
{
  "defaultSite": "acme",
  "sites": [
    { "name": "acme", "url": "https://acme.atlassian.net", "email": "you@acme.com", "apiToken": "token-a" },
    { "name": "client-xyz", "url": "https://client-xyz.atlassian.net", "email": "you@client-xyz.com", "apiToken": "token-b", "safetyLevel": "readonly" }
  ]
}
```

### Mock mode

Set `"mock": true` in the config to let `confluence_doctor` validate config shape without making a live request.

## Tools

### Read

| Tool | Description |
| --- | --- |
| `confluence_doctor` | Verify configuration and connection health |
| `confluence_get_page` | Fetch a Confluence page by id |
| `confluence_search_content` | Search with CQL |
| `confluence_get_page_children` | List child pages of a page |
| `confluence_list_spaces` | List spaces |
| `confluence_get_page_comments` | List comments on a page |

### Write (safety-gated)

| Tool | Description |
| --- | --- |
| `confluence_create_page` | Create a page in a space |
| `confluence_update_page` | Update a page with version increment |
| `confluence_add_comment` | Add a page comment |
| `confluence_add_label` | Add a page label |

## Commands

| Command | Description |
| --- | --- |
| `/confluence-status` | Show current connection status (site, safety level) |
| `/confluence-doctor` | Check configuration, auth, and API reachability |

## Prompt templates

| Template | Description |
| --- | --- |
| `/confluence-daily-status` | Summarize daily updates from recently changed pages |
| `/confluence-release-notes` | Prepare/update release notes page |
| `/confluence-space-search` | Search and summarize content for a specific space |

## Configuration reference

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `sites` | array | — | List of `{ name, url, email, apiToken, safetyLevel?, headlessApprovals? }` |
| `defaultSite` | string | first site | Default site name used when a tool call omits `site` |
| `safetyLevel` | string | `"confirm"` | Global default: `"open"`, `"confirm"`, or `"readonly"` |
| `mock` | boolean | `false` | Skip live request in `confluence_doctor` |

### Headless write approvals

In `confirm` mode, writes without an interactive UI remain blocked unless the selected site defines a matching `headlessApprovals` rule.

```json
{
  "sites": [{
    "name": "automation",
    "url": "https://acme.atlassian.net",
    "email": "bot@acme.com",
    "apiToken": "your-api-token",
    "headlessApprovals": [
      { "action": "confluence_create_page", "spaceKey": "ENG" },
      { "action": "confluence_update_page", "pageIds": ["123456"] }
    ]
  }]
}
```

## Development

```bash
npm install
npm test
npm run check
```

Run against a local checkout from anywhere with:

```bash
pi install /absolute/path/to/pi-confluence-multiproject
# or, for a one-off session:
pi -e /absolute/path/to/pi-confluence-multiproject
```

## Requirements

- Node.js 22.19+
- pi coding agent
- Confluence Cloud site with API token

## License

MIT — see [LICENSE](LICENSE).
