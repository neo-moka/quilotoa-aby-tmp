//! Live MCP connection inspection for the settings catalog.
//!
//! The webview cannot talk to arbitrary MCP endpoints (CORS), so the desktop
//! side implements the minimal streamable-HTTP client surface the "View
//! tools" panel needs: `initialize` → `tools/list` (and `tools/call` for the
//! try-it flow). Servers may answer each POST either as plain JSON or as an
//! SSE stream carrying the JSON-RPC response; both shapes are handled, and
//! SSE reads stop as soon as the matching response arrives instead of waiting
//! for the server to close the stream.

use futures_util::StreamExt;
use serde::Serialize;
use std::time::Duration;

const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);
/// Upper bound on accumulated response bytes — a misbehaving server must not
/// balloon the desktop process.
const MAX_RESPONSE_BYTES: usize = 4 * 1024 * 1024;
const PROTOCOL_VERSION: &str = "2025-03-26";

/// Provider behavior annotations, forwarded verbatim as hints (never
/// guarantees) for the badge row in the tools panel.
#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolAnnotations {
    pub read_only_hint: Option<bool>,
    pub destructive_hint: Option<bool>,
    pub idempotent_hint: Option<bool>,
    pub open_world_hint: Option<bool>,
}

/// One tool as advertised by the server's `tools/list`.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolInfo {
    pub name: String,
    pub title: Option<String>,
    pub description: Option<String>,
    /// Number of top-level properties in the tool's input schema.
    pub input_count: usize,
    pub annotations: McpToolAnnotations,
}

/// Result of probing a connection: server identity plus its tool list.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct McpToolsProbe {
    pub server_name: Option<String>,
    pub server_version: Option<String>,
    pub tools: Vec<McpToolInfo>,
}

fn build_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .map_err(|error| format!("http client: {error}"))
}

/// Extract the JSON-RPC message with `id` from a response body that is either
/// plain JSON or an SSE stream (`data:` lines). Returns early once found.
async fn read_jsonrpc_response(
    response: reqwest::Response,
    id: u64,
) -> Result<serde_json::Value, String> {
    let status = response.status();
    if !status.is_success() {
        return Err(format!("server answered {status}"));
    }
    let is_sse = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.contains("text/event-stream"));

    let mut buffer: Vec<u8> = Vec::new();
    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|error| format!("read: {error}"))?;
        buffer.extend_from_slice(&chunk);
        if buffer.len() > MAX_RESPONSE_BYTES {
            return Err("response exceeded 4MB".to_string());
        }
        if is_sse {
            if let Some(message) = extract_sse_message(&buffer, id) {
                return Ok(message);
            }
        }
    }
    if is_sse {
        extract_sse_message(&buffer, id)
            .ok_or_else(|| "stream ended without a matching response".to_string())
    } else {
        serde_json::from_slice::<serde_json::Value>(&buffer)
            .map_err(|error| format!("invalid JSON response: {error}"))
    }
}

/// Scan complete SSE `data:` payloads for the JSON-RPC response with `id`.
fn extract_sse_message(buffer: &[u8], id: u64) -> Option<serde_json::Value> {
    let text = String::from_utf8_lossy(buffer);
    for line in text.lines() {
        let Some(payload) = line.strip_prefix("data:") else {
            continue;
        };
        let Ok(message) = serde_json::from_str::<serde_json::Value>(payload.trim()) else {
            continue;
        };
        if message.get("id").and_then(serde_json::Value::as_u64) == Some(id) {
            return Some(message);
        }
    }
    None
}

fn unwrap_result(message: serde_json::Value) -> Result<serde_json::Value, String> {
    if let Some(error) = message.get("error") {
        let text = error
            .get("message")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("unknown server error");
        return Err(format!("MCP error: {text}"));
    }
    message
        .get("result")
        .cloned()
        .ok_or_else(|| "response carried neither result nor error".to_string())
}

struct McpHttpSession {
    client: reqwest::Client,
    url: String,
    auth: Option<String>,
    session_id: Option<String>,
    next_id: u64,
}

impl McpHttpSession {
    /// Open a session: `initialize`, capture `Mcp-Session-Id`, and send the
    /// `notifications/initialized` the spec requires before further calls.
    async fn connect(
        url: String,
        auth: Option<String>,
    ) -> Result<(Self, serde_json::Value), String> {
        let mut session = Self {
            client: build_client()?,
            url,
            auth,
            session_id: None,
            next_id: 1,
        };
        let init = session
            .request(
                "initialize",
                serde_json::json!({
                    "protocolVersion": PROTOCOL_VERSION,
                    "capabilities": {},
                    "clientInfo": {"name": "aby-desktop", "version": env!("CARGO_PKG_VERSION")},
                }),
            )
            .await?;
        session.notify("notifications/initialized").await?;
        Ok((session, init))
    }

    fn post(&self, body: &serde_json::Value) -> reqwest::RequestBuilder {
        let mut request = self
            .client
            .post(&self.url)
            .header(
                reqwest::header::ACCEPT,
                "application/json, text/event-stream",
            )
            .json(body);
        if let Some(ref auth) = self.auth {
            request = request.bearer_auth(auth);
        }
        if let Some(ref session_id) = self.session_id {
            request = request.header("Mcp-Session-Id", session_id.clone());
        }
        request
    }

    async fn request(
        &mut self,
        method: &str,
        params: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        let id = self.next_id;
        self.next_id += 1;
        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "id": id,
            "method": method,
            "params": params,
        });
        let response = self
            .post(&body)
            .send()
            .await
            .map_err(|error| format!("{method}: {error}"))?;
        if let Some(session_id) = response
            .headers()
            .get("mcp-session-id")
            .and_then(|value| value.to_str().ok())
        {
            self.session_id = Some(session_id.to_string());
        }
        unwrap_result(read_jsonrpc_response(response, id).await?)
    }

    async fn notify(&self, method: &str) -> Result<(), String> {
        let body = serde_json::json!({"jsonrpc": "2.0", "method": method});
        // Notifications get 202/204 with no body; errors here are non-fatal
        // for strict servers but a transport failure still surfaces.
        self.post(&body)
            .send()
            .await
            .map_err(|error| format!("{method}: {error}"))?;
        Ok(())
    }
}

fn tool_from_value(value: &serde_json::Value) -> Option<McpToolInfo> {
    let name = value.get("name")?.as_str()?.to_string();
    let annotations = value.get("annotations");
    let hint = |key: &str| {
        annotations
            .and_then(|a| a.get(key))
            .and_then(serde_json::Value::as_bool)
    };
    Some(McpToolInfo {
        name,
        title: value
            .get("title")
            .and_then(serde_json::Value::as_str)
            .map(str::to_string),
        description: value
            .get("description")
            .and_then(serde_json::Value::as_str)
            .map(str::to_string),
        input_count: value
            .get("inputSchema")
            .and_then(|schema| schema.get("properties"))
            .and_then(serde_json::Value::as_object)
            .map_or(0, serde_json::Map::len),
        annotations: McpToolAnnotations {
            read_only_hint: hint("readOnlyHint"),
            destructive_hint: hint("destructiveHint"),
            idempotent_hint: hint("idempotentHint"),
            open_world_hint: hint("openWorldHint"),
        },
    })
}

/// List the tools a remote MCP connection exposes, live from the server.
#[tauri::command]
pub async fn mcp_probe_tools(url: String, auth: Option<String>) -> Result<McpToolsProbe, String> {
    let (mut session, init) = McpHttpSession::connect(url, auth).await?;
    let server_info = init.get("serverInfo");
    let listed = session.request("tools/list", serde_json::json!({})).await?;
    let tools = listed
        .get("tools")
        .and_then(serde_json::Value::as_array)
        .map(|entries| entries.iter().filter_map(tool_from_value).collect())
        .unwrap_or_default();
    Ok(McpToolsProbe {
        server_name: server_info
            .and_then(|info| info.get("name"))
            .and_then(serde_json::Value::as_str)
            .map(str::to_string),
        server_version: server_info
            .and_then(|info| info.get("version"))
            .and_then(serde_json::Value::as_str)
            .map(str::to_string),
        tools,
    })
}

/// Invoke one tool with caller-provided arguments and return the raw MCP
/// result payload for display. This is the "try it" path — the caller decides
/// what to send; nothing is retried or interpreted here.
#[tauri::command]
pub async fn mcp_call_tool(
    url: String,
    auth: Option<String>,
    name: String,
    arguments: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let (mut session, _init) = McpHttpSession::connect(url, auth).await?;
    session
        .request(
            "tools/call",
            serde_json::json!({"name": name, "arguments": arguments}),
        )
        .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sse_scan_finds_the_matching_id_only() {
        let body = concat!(
            "event: message\n",
            "data: {\"jsonrpc\":\"2.0\",\"id\":7,\"result\":{\"a\":1}}\n\n",
            "data: {\"jsonrpc\":\"2.0\",\"id\":2,\"result\":{\"b\":2}}\n\n",
            "data: not-json\n\n",
        )
        .as_bytes();
        let hit = extract_sse_message(body, 2);
        assert_eq!(
            hit.and_then(|m| m.get("result").cloned()),
            Some(serde_json::json!({"b": 2}))
        );
        assert!(extract_sse_message(body, 9).is_none());
    }

    #[test]
    fn tool_parsing_counts_inputs_and_maps_hints() {
        let tool = tool_from_value(&serde_json::json!({
            "name": "notion-search",
            "description": "Search things",
            "inputSchema": {"type": "object", "properties": {"q": {}, "limit": {}}},
            "annotations": {"readOnlyHint": true, "openWorldHint": true},
        }))
        .expect("tool should parse");
        assert_eq!(tool.input_count, 2);
        assert_eq!(tool.annotations.read_only_hint, Some(true));
        assert_eq!(tool.annotations.destructive_hint, None);
        assert!(tool_from_value(&serde_json::json!({"description": "no name"})).is_none());
    }

    #[test]
    fn jsonrpc_errors_surface_their_message() {
        let err = unwrap_result(serde_json::json!({
            "jsonrpc": "2.0", "id": 1,
            "error": {"code": -32000, "message": "bad token"},
        }));
        assert_eq!(err, Err("MCP error: bad token".to_string()));
    }
}
