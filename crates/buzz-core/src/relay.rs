//! Canonical relay identities shared by runtime components.

use thiserror::Error;
use url::{Host, Url};

/// Errors returned while canonicalizing a relay URL for runtime identity.
#[derive(Debug, Error, PartialEq, Eq)]
pub enum NormalizeRelayUrlError {
    /// The input is not a valid URL.
    #[error("invalid relay URL: {0}")]
    InvalidUrl(String),
    /// Relay sockets must use WebSocket schemes.
    #[error("relay URL scheme must be ws or wss")]
    InvalidScheme,
    /// Relay identity never includes user credentials.
    #[error("relay URL must not contain credentials")]
    Credentials,
    /// Relay identity never includes a fragment.
    #[error("relay URL must not contain a fragment")]
    Fragment,
    /// A relay URL requires a host.
    #[error("relay URL must contain a host")]
    MissingHost,
}

/// Canonicalize a WebSocket relay URL for use as a runtime identity key.
///
/// This is the sole normalizer for `(agent, relay)` process identity. It keeps
/// the WebSocket scheme, lowercases DNS hosts, removes default ports and a root
/// slash, and preserves non-root paths and queries. It deliberately is **not**
/// the NIP-42 AUTH comparison helper in `buzz-auth`: AUTH validation is a
/// security boundary with narrower equivalence rules and must not be widened by
/// runtime-key canonicalization.
///
/// The host survives verbatim apart from case, because it is
/// **tenant-identifying**: the relay resolves a request's community from the
/// connection host via [`crate::tenant::normalize_host`], which does not alias
/// loopback spellings — `ws://localhost:3000` and `ws://127.0.0.1:3000` are two
/// distinct communities. Folding one spelling into the other here would hand
/// the caller a key naming a community its configured URL never referred to,
/// and a harness connecting on that key authenticates fine, resolves an empty
/// member set, and then sits silently idle.
///
/// Connection code may retain the configured URL; this canonical form is for
/// identity, receipts, status and deduplication.
pub fn normalize_relay_url(raw: &str) -> Result<String, NormalizeRelayUrlError> {
    let mut url = Url::parse(raw.trim())
        .map_err(|error| NormalizeRelayUrlError::InvalidUrl(error.to_string()))?;
    if !matches!(url.scheme(), "ws" | "wss") {
        return Err(NormalizeRelayUrlError::InvalidScheme);
    }
    if !url.username().is_empty() || url.password().is_some() {
        return Err(NormalizeRelayUrlError::Credentials);
    }
    if url.fragment().is_some() {
        return Err(NormalizeRelayUrlError::Fragment);
    }

    let host = url.host().ok_or(NormalizeRelayUrlError::MissingHost)?;
    // Case is the only host equivalence: DNS is case-insensitive, tenancy is
    // not. IP literals are already canonical and are left untouched.
    let lowercased_domain = match host {
        Host::Domain(domain) => Some(domain.to_ascii_lowercase()),
        Host::Ipv4(_) | Host::Ipv6(_) => None,
    };
    if let Some(domain) = lowercased_domain {
        url.set_host(Some(&domain))
            .map_err(|_| NormalizeRelayUrlError::MissingHost)?;
    }

    let default_port = match url.scheme() {
        "ws" => Some(80),
        "wss" => Some(443),
        _ => None,
    };
    if url.port() == default_port {
        url.set_port(None)
            .map_err(|_| NormalizeRelayUrlError::InvalidScheme)?;
    }
    if url.path() == "/" {
        url.set_path("");
    }
    Ok(url.to_string().trim_end_matches('/').to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loopback_spellings_are_distinct_identities() {
        // The relay derives a request's community from the connection host and
        // does NOT alias loopback spellings (see `tenant::normalize_host`), so
        // `localhost:3000` and `127.0.0.1:3000` are two separate communities.
        // Folding them here produced a key naming a community the configured
        // URL never referred to: the harness authenticated against the wrong
        // tenant, discovered zero channels, and sat idle while its owner's
        // messages piled up in the other one.
        let ipv6 = normalize_relay_url("wss://[::1]/").unwrap();
        let ipv4 = normalize_relay_url("wss://127.0.0.1/").unwrap();
        let localhost = normalize_relay_url("wss://localhost/").unwrap();
        assert_eq!(ipv6, "wss://[::1]");
        assert_eq!(ipv4, "wss://127.0.0.1");
        assert_eq!(localhost, "wss://localhost");
        assert_ne!(ipv4, localhost);
        assert_ne!(ipv6, ipv4);
    }

    #[test]
    fn host_case_is_still_an_identity_equivalence() {
        // DNS is case-insensitive, so case must not fork a tenant — this is the
        // one host equivalence the canonical form still collapses.
        assert_eq!(
            normalize_relay_url("ws://LocalHost:3000").unwrap(),
            "ws://localhost:3000"
        );
        assert_eq!(
            normalize_relay_url("ws://localhost:3000").unwrap(),
            "ws://localhost:3000"
        );
    }

    #[test]
    fn canonicalizes_only_identity_equivalences() {
        assert_eq!(
            normalize_relay_url(" WSS://Relay.Example:443/ ").unwrap(),
            "wss://relay.example"
        );
        assert_eq!(
            normalize_relay_url("ws://relay.example:8080/community/?x=1").unwrap(),
            "ws://relay.example:8080/community/?x=1"
        );
    }

    #[test]
    fn rejects_non_relay_and_ambiguous_urls() {
        assert_eq!(
            normalize_relay_url("https://relay.example").unwrap_err(),
            NormalizeRelayUrlError::InvalidScheme
        );
        assert_eq!(
            normalize_relay_url("wss://user@relay.example").unwrap_err(),
            NormalizeRelayUrlError::Credentials
        );
        assert_eq!(
            normalize_relay_url("wss://relay.example/#x").unwrap_err(),
            NormalizeRelayUrlError::Fragment
        );
    }
}
