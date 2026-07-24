// Notion export — ported from Bebop Blueprint's exportImprovMapToNotion,
// moved server-side because the Notion API rejects browser CORS requests.
// The integration token arrives per-request from the user and is never stored.

const NOTION_VERSION = "2022-06-28"
// Bebop Blueprint's improv-map parent page — overridable per request.
const DEFAULT_PARENT_PAGE_ID = "317d608ca53480e0ba3ae6980b4efd1c"
const BLOCK_BATCH = 90   // Notion caps children appends at 100

// Mini markdown → Notion rich_text: **bold** and `code` (from BB's converter)
function mdToRichText(text) {
  const out = []
  const parts = String(text || "").split(/(\*\*[^*]+\*\*|`[^`]+`)/g).filter(Boolean)
  for (const p of parts) {
    if (p.startsWith("**") && p.endsWith("**")) {
      out.push({ type: "text", text: { content: p.slice(2, -2) }, annotations: { bold: true } })
    } else if (p.startsWith("`") && p.endsWith("`")) {
      out.push({ type: "text", text: { content: p.slice(1, -1) }, annotations: { code: true } })
    } else {
      out.push({ type: "text", text: { content: p } })
    }
  }
  return out.length ? out : [{ type: "text", text: { content: "" } }]
}

const cell = (s) => [{ type: "text", text: { content: String(s ?? "") } }]

function buildBlocks({ key, tempo, tableRows, roadmap }) {
  const blocks = []

  blocks.push({
    object: "block", type: "paragraph",
    paragraph: { rich_text: mdToRichText(`**Key:** ${key}${tempo ? `  ·  **Tempo:** ${tempo}` : ""}`) },
  })

  // Summary table
  blocks.push({
    object: "block", type: "heading_2",
    heading_2: { rich_text: cell("Improv Map Table") },
  })
  const header = ["Section", "Bar", "Chord", "Hexatonic Scale", "Triad Pairs", "Voice Leading"]
  blocks.push({
    object: "block", type: "table",
    table: {
      table_width: header.length,
      has_column_header: true,
      has_row_header: false,
      children: [
        { object: "block", type: "table_row", table_row: { cells: header.map(cell) } },
        ...tableRows.map(r => ({
          object: "block", type: "table_row",
          table_row: { cells: [r.section, r.bar, r.chord, r.hex, r.triads, r.voiceLeading].map(cell) },
        })),
      ],
    },
  })

  // Chord-by-chord roadmap as collapsible toggles
  blocks.push({
    object: "block", type: "heading_2",
    heading_2: { rich_text: cell("Chord-by-Chord Roadmap") },
  })
  for (const item of roadmap) {
    blocks.push({
      object: "block", type: "toggle",
      toggle: {
        rich_text: mdToRichText(`**Bar ${item.bar}: ${item.chord}**`),
        children: item.levels.map(l => ({
          object: "block", type: "bulleted_list_item",
          bulleted_list_item: { rich_text: mdToRichText(l) },
        })),
      },
    })
  }
  return blocks
}

async function notion(token, path, method, body) {
  const res = await fetch(`https://api.notion.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.message || `Notion API ${res.status}`)
  return data
}

export async function POST(request) {
  try {
    const { token, parentPageId, title, key, tempo, tableRows, roadmap } = await request.json()
    if (!token) return Response.json({ error: "Missing Notion integration token" }, { status: 400 })
    if (!Array.isArray(tableRows) || !Array.isArray(roadmap))
      return Response.json({ error: "Missing improv-map data" }, { status: 400 })

    const blocks = buildBlocks({ key, tempo, tableRows, roadmap })

    // Create the child page with the first batch, append the rest in chunks
    const first = blocks.slice(0, BLOCK_BATCH)
    const page = await notion(token, "pages", "POST", {
      parent: { page_id: parentPageId || DEFAULT_PARENT_PAGE_ID },
      properties: {
        title: { title: [{ type: "text", text: { content: title || "DukeBox Improv Map" } }] },
      },
      children: first,
    })

    for (let i = BLOCK_BATCH; i < blocks.length; i += BLOCK_BATCH) {
      await notion(token, `blocks/${page.id}/children`, "PATCH", {
        children: blocks.slice(i, i + BLOCK_BATCH),
      })
    }

    return Response.json({ ok: true, pageId: page.id, url: page.url })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 502 })
  }
}
