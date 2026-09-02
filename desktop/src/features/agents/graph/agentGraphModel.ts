import { normalizePubkey } from "@/shared/lib/pubkey";

/**
 * Pure model behind the agent communication graph.
 *
 * Nodes are the agent roster (plus the viewer); edges are directed message
 * passes between them, derived from channel messages: every p-tag on a
 * node-authored message is one pass to that node. A message carrying an `e`
 * tag is answering inside a thread — that is the dependency signal the graph
 * separates from a plain mention (an assignment or hand-off).
 *
 * Kept free of React and fetching so tests can drive it with hand-built
 * events, mirroring `agentRunSummaries`.
 */

export type AgentGraphRosterEntry = {
  pubkey: string;
  name: string;
  avatarUrl?: string | null;
  /**
   * Optional participants (human community members) render only when they
   * actually take part in the flow — a node with zero traffic would be
   * roster noise, not communication.
   */
  optional?: boolean;
};

export type AgentGraphNode = {
  pubkey: string;
  name: string;
  avatarUrl: string | null;
  isViewer: boolean;
  isHuman: boolean;
  sent: number;
  received: number;
};

export type AgentGraphMessageRef = {
  id: string;
  at: number;
  snippet: string;
  channelId: string | null;
  isReply: boolean;
};

export type AgentGraphEdge = {
  from: string;
  to: string;
  count: number;
  replyCount: number;
  lastAt: number;
  /** Newest first, capped at `recentCap`. */
  recent: AgentGraphMessageRef[];
};

/** One message visibly in flight along an edge (see AgentGraphView). */
export type AgentGraphFlight = {
  key: string;
  from: string;
  to: string;
  snippet: string;
};

export type AgentGraphModel = {
  nodes: AgentGraphNode[];
  edges: AgentGraphEdge[];
  lastAt: number | null;
};

type GraphEventLike = {
  id: string;
  pubkey: string;
  created_at: number;
  content: string;
  tags: string[][];
};

const RECENT_CAP = 8;
const SNIPPET_LENGTH = 140;

function snippetOf(content: string): string {
  const collapsed = content.replace(/\s+/g, " ").trim();
  return collapsed.length > SNIPPET_LENGTH
    ? `${collapsed.slice(0, SNIPPET_LENGTH - 1)}…`
    : collapsed;
}

function firstTagValue(tags: string[][], name: string): string | null {
  for (const tag of tags) {
    if (tag[0] === name && typeof tag[1] === "string" && tag[1].length > 0) {
      return tag[1];
    }
  }
  return null;
}

export function buildAgentGraphModel({
  roster,
  viewer,
  events,
}: {
  roster: AgentGraphRosterEntry[];
  viewer: AgentGraphRosterEntry | null;
  events: GraphEventLike[];
}): AgentGraphModel {
  const nodesByPubkey = new Map<string, AgentGraphNode>();
  const optionalPubkeys = new Set<string>();
  const addNode = (entry: AgentGraphRosterEntry, isViewer: boolean) => {
    const pubkey = normalizePubkey(entry.pubkey);
    if (!nodesByPubkey.has(pubkey)) {
      nodesByPubkey.set(pubkey, {
        pubkey,
        name: entry.name,
        avatarUrl: entry.avatarUrl ?? null,
        isViewer,
        isHuman: isViewer || entry.optional === true,
        sent: 0,
        received: 0,
      });
      if (!isViewer && entry.optional) optionalPubkeys.add(pubkey);
    }
  };
  for (const entry of roster) {
    addNode(entry, false);
  }
  if (viewer) {
    addNode(viewer, true);
  }

  const edgesByKey = new Map<string, AgentGraphEdge>();
  const seenEventIds = new Set<string>();
  let lastAt: number | null = null;

  for (const event of events) {
    if (seenEventIds.has(event.id)) continue;
    seenEventIds.add(event.id);

    const author = normalizePubkey(event.pubkey);
    const authorNode = nodesByPubkey.get(author);
    if (!authorNode) continue;

    const isReply = event.tags.some(
      (tag) => tag[0] === "e" && typeof tag[1] === "string",
    );
    const channelId = firstTagValue(event.tags, "h");
    const targets = new Set<string>();
    for (const tag of event.tags) {
      if (tag[0] !== "p" || typeof tag[1] !== "string") continue;
      const target = normalizePubkey(tag[1]);
      if (target !== author && nodesByPubkey.has(target)) {
        targets.add(target);
      }
    }
    if (targets.size === 0) continue;

    const ref: AgentGraphMessageRef = {
      id: event.id,
      at: event.created_at,
      snippet: snippetOf(event.content),
      channelId,
      isReply,
    };

    for (const target of targets) {
      const key = `${author}→${target}`;
      let edge = edgesByKey.get(key);
      if (!edge) {
        edge = {
          from: author,
          to: target,
          count: 0,
          replyCount: 0,
          lastAt: 0,
          recent: [],
        };
        edgesByKey.set(key, edge);
      }
      edge.count += 1;
      if (isReply) edge.replyCount += 1;
      edge.lastAt = Math.max(edge.lastAt, event.created_at);
      edge.recent.push(ref);
      authorNode.sent += 1;
      const targetNode = nodesByPubkey.get(target);
      if (targetNode) targetNode.received += 1;
      if (lastAt === null || event.created_at > lastAt) {
        lastAt = event.created_at;
      }
    }
  }

  for (const edge of edgesByKey.values()) {
    edge.recent.sort((left, right) => right.at - left.at);
    edge.recent = edge.recent.slice(0, RECENT_CAP);
  }

  for (const pubkey of optionalPubkeys) {
    const node = nodesByPubkey.get(pubkey);
    if (node && node.sent === 0 && node.received === 0) {
      nodesByPubkey.delete(pubkey);
    }
  }

  const nodes = [...nodesByPubkey.values()].sort((left, right) =>
    left.isViewer !== right.isViewer
      ? Number(left.isViewer) - Number(right.isViewer)
      : left.name.localeCompare(right.name),
  );
  const edges = [...edgesByKey.values()].sort(
    (left, right) => right.lastAt - left.lastAt,
  );

  return { nodes, edges, lastAt };
}

/** Edges touching a node, newest traffic first. */
export function edgesForNode(
  model: AgentGraphModel,
  pubkey: string,
): AgentGraphEdge[] {
  const normalized = normalizePubkey(pubkey);
  return model.edges.filter(
    (edge) => edge.from === normalized || edge.to === normalized,
  );
}
