//! Conversion and verification for relay-discovered agents.

use std::collections::{BTreeSet, HashMap};

use nostr::Event;

use crate::managed_agents::{agent_events::managed_agent_content_from_event, RelayAgentInfo};

use super::{agents_from_events, first_tag_value, profile_valid_oa_owner_pubkey, tags_named};

/// Collect valid agent pubkeys from kind:30177 `d` tags for follow-up relay
/// queries. Malformed tags are ignored so one hostile event cannot invalidate
/// the whole directory request.
pub fn managed_agent_pubkeys_from_events(events: &[Event]) -> std::collections::HashSet<String> {
    events
        .iter()
        .filter_map(|event| first_tag_value(event, "d"))
        .filter_map(|pubkey| nostr::PublicKey::from_hex(pubkey).ok())
        .map(|pubkey| pubkey.to_hex())
        .collect()
}

fn event_is_newer(candidate: &Event, previous: &Event) -> bool {
    candidate.created_at > previous.created_at
        || (candidate.created_at == previous.created_at && candidate.id < previous.id)
}

fn relay_agents_from_legacy_events(events: &[Event]) -> Vec<RelayAgentInfo> {
    let mut latest: HashMap<String, &Event> = HashMap::new();
    for event in events {
        let pubkey = event.pubkey.to_hex();
        if latest
            .get(&pubkey)
            .is_none_or(|previous| event_is_newer(event, previous))
        {
            latest.insert(pubkey, event);
        }
    }

    latest
        .into_values()
        .filter_map(|event| {
            let value = agents_from_events(std::slice::from_ref(event));
            let mut agent: RelayAgentInfo =
                serde_json::from_value(value.get("agents")?.as_array()?.first()?.clone()).ok()?;
            // Legacy directory entries are not authenticated managed-policy
            // coordinates, so they must not drive the live 30177 watcher.
            agent.owner_pubkey = None;
            // Channel membership is authoritative only in relay-signed kind:39002.
            agent.channel_ids.clear();
            Some(agent)
        })
        .collect()
}

/// Merge self-authored kind:10100 runtime profiles with verified Desktop-managed
/// policy records. A verified managed coordinate reserves the agent identity even
/// when its current policy is malformed, so stale legacy permissions cannot win.
pub fn relay_agents_from_directory_events(
    directory_events: &[Event],
    managed_agent_events: &[Event],
    profile_events: &[Event],
) -> Vec<RelayAgentInfo> {
    let verified_policies = latest_verified_managed_policies(managed_agent_events, profile_events);
    let mut agents: HashMap<String, RelayAgentInfo> =
        relay_agents_from_legacy_events(directory_events)
            .into_iter()
            .map(|agent| (agent.pubkey.clone(), agent))
            .collect();
    for agent_pubkey in verified_policies.keys() {
        agents.remove(agent_pubkey);
    }
    for (agent_pubkey, event) in verified_policies {
        if let Some(agent) = relay_agent_from_managed_policy(&agent_pubkey, event) {
            agents.insert(agent_pubkey, agent);
        }
    }

    let mut agents: Vec<_> = agents.into_values().collect();
    apply_profile_avatars(&mut agents, profile_events);
    agents.sort_by(|left, right| left.name.cmp(&right.name));
    agents
}

fn latest_profiles_by_pubkey(events: &[Event]) -> HashMap<String, &Event> {
    let mut latest_profiles: HashMap<String, &Event> = HashMap::new();
    for profile in events {
        let agent_pubkey = profile.pubkey.to_hex();
        if latest_profiles
            .get(&agent_pubkey)
            .is_none_or(|previous| event_is_newer(profile, previous))
        {
            latest_profiles.insert(agent_pubkey, profile);
        }
    }
    latest_profiles
}

/// Resolve each agent's owner from its latest signed NIP-OA profile.
pub fn verified_agent_owners_from_profiles(events: &[Event]) -> HashMap<String, String> {
    latest_profiles_by_pubkey(events)
        .into_iter()
        .filter_map(|(agent_pubkey, profile)| {
            profile_valid_oa_owner_pubkey(profile).map(|owner| (agent_pubkey, owner))
        })
        .collect()
}

/// Resolve each agent's avatar from its latest kind:0 profile `picture`.
fn agent_avatars_from_profiles(events: &[Event]) -> HashMap<String, String> {
    latest_profiles_by_pubkey(events)
        .into_iter()
        .filter_map(|(agent_pubkey, profile)| {
            let content = serde_json::from_str::<serde_json::Value>(&profile.content).ok()?;
            let picture = content.get("picture")?.as_str()?.trim().to_string();
            (!picture.is_empty()).then_some((agent_pubkey, picture))
        })
        .collect()
}

/// Overlay profile-sourced avatars onto a built agent list. The profile wins
/// over anything a legacy kind:10100 record carried: it is what everyone else
/// in the community sees the agent as.
fn apply_profile_avatars(agents: &mut [RelayAgentInfo], profile_events: &[Event]) {
    let avatars = agent_avatars_from_profiles(profile_events);
    for agent in agents {
        if let Some(url) = avatars.get(&agent.pubkey) {
            agent.avatar_url = Some(url.clone());
        }
    }
}

fn latest_verified_managed_policies<'a>(
    managed_agent_events: &'a [Event],
    profile_events: &[Event],
) -> HashMap<String, &'a Event> {
    let verified_owners = verified_agent_owners_from_profiles(profile_events);

    let mut latest: HashMap<String, &'a Event> = HashMap::new();
    for event in managed_agent_events {
        let Some(agent_pubkey) = first_tag_value(event, "d") else {
            continue;
        };
        if verified_owners.get(agent_pubkey) != Some(&event.pubkey.to_hex()) {
            continue;
        }
        if latest
            .get(agent_pubkey)
            .is_none_or(|previous| event_is_newer(event, previous))
        {
            latest.insert(agent_pubkey.to_string(), event);
        }
    }
    latest
}

fn relay_agent_from_managed_policy(agent_pubkey: &str, event: &Event) -> Option<RelayAgentInfo> {
    let content = managed_agent_content_from_event(event).ok()?;
    Some(RelayAgentInfo {
        pubkey: agent_pubkey.to_string(),
        owner_pubkey: Some(event.pubkey.to_hex()),
        name: content.name,
        avatar_url: None,
        agent_type: "agent".to_string(),
        channels: Vec::new(),
        channel_ids: Vec::new(),
        capabilities: Vec::new(),
        status: "offline".to_string(),
        respond_to: Some(content.respond_to),
        respond_to_allowlist: content.respond_to_allowlist,
    })
}

/// Build the relay agent directory from owner-authenticated managed-agent
/// records. A kind:30177 event is accepted only when its author matches the
/// owner cryptographically declared by the agent's latest kind:0 NIP-OA tag.
pub fn relay_agents_from_managed_agent_events(
    managed_agent_events: &[Event],
    profile_events: &[Event],
) -> Vec<RelayAgentInfo> {
    let mut agents: Vec<_> = latest_verified_managed_policies(managed_agent_events, profile_events)
        .into_iter()
        .filter_map(|(agent_pubkey, event)| relay_agent_from_managed_policy(&agent_pubkey, event))
        .collect();
    apply_profile_avatars(&mut agents, profile_events);
    agents.sort_by(|left, right| left.name.cmp(&right.name));
    agents
}

/// Build a pubkey-to-channel-id candidate map from relay-signed membership
/// events. Only p-tags explicitly marked with the `bot` role are agents.
pub fn member_agent_channel_ids_from_events(
    events: &[Event],
    relay_pubkey: &str,
) -> HashMap<String, Vec<String>> {
    let mut channel_ids: HashMap<String, BTreeSet<String>> = HashMap::new();
    for event in events {
        if !event.pubkey.to_hex().eq_ignore_ascii_case(relay_pubkey) {
            continue;
        }
        let Some(channel_id) = first_tag_value(event, "d") else {
            continue;
        };
        for tag in tags_named(event, "p") {
            let (Some(pubkey), Some(role)) = (tag.get(1), tag.get(3)) else {
                continue;
            };
            if role != "bot" || nostr::PublicKey::from_hex(pubkey).is_err() {
                continue;
            }
            channel_ids
                .entry(pubkey.clone())
                .or_default()
                .insert(channel_id.to_string());
        }
    }

    channel_ids
        .into_iter()
        .map(|(pubkey, ids)| (pubkey, ids.into_iter().collect()))
        .collect()
}
