# Trion — Threat Intelligence

Trion SOC enriches IOCs (Indicators of Compromise) extracted from Wazuh alerts against three external APIs during the `soc-triage` workflow.

---

## APIs

### VirusTotal

Used for all three IOC types: IP addresses, file hashes (SHA-256 and MD5), and domains.

- **Endpoint (IP):** `GET /api/v3/ip_addresses/{ip}`
- **Endpoint (hash):** `GET /api/v3/files/{hash}`
- **Endpoint (domain):** `GET /api/v3/domains/{domain}`
- **Verdict logic:** malicious if `last_analysis_stats.malicious > 0`
- **Rate limit (free tier):** 4 requests/minute
- **n8n handling:** 15-second Wait node between consecutive VirusTotal calls to stay within the free tier limit

### AbuseIPDB

Used for IP addresses only.

- **Endpoint:** `GET /api/v2/check?ipAddress={ip}&maxAgeInDays=90`
- **Verdict logic:** malicious if `abuseConfidenceScore >= 50`
- **Rate limit (free tier):** 1,000 requests/day
- **n8n handling:** called in parallel with VirusTotal for IP enrichment (no wait needed — separate quota)

### MalwareBazaar

Used for file hashes (SHA-256 and MD5) only.

- **Endpoint:** `POST /api/v1/` with `query=get_info&hash={hash}`
- **Verdict logic:** malicious if `query_status == "hash_found"`
- **Rate limit:** no hard limit published for the lookup endpoint
- **n8n handling:** called in parallel with VirusTotal for hash enrichment

---

## IOC types supported

| IOC type | Extracted from | APIs queried |
|----------|---------------|-------------|
| IP address | `data.srcip`, `data.dstip` | VirusTotal + AbuseIPDB |
| SHA-256 hash | `syscheck.sha256_after` | VirusTotal + MalwareBazaar |
| MD5 hash | `syscheck.md5_after` | VirusTotal + MalwareBazaar |
| Domain / URL | `data.url` | VirusTotal |

Private and loopback IP ranges are filtered out before enrichment (RFC 1918: `10.x`, `172.16–31.x`, `192.168.x`; loopback: `127.x`, `::1`).

---

## Verdicts

Each IOC receives one of four verdicts:

| Verdict | Meaning |
|---------|---------|
| `CLEAN` | No API flagged the IOC as malicious |
| `SUSPICIOUS` | Low-confidence signal — score below malicious threshold |
| `MALICIOUS` | At least one API positively identified the IOC |
| `UNKNOWN` | API unavailable, rate limited, or returned no data |

The alert-level verdict shown in the Slack notification is the worst verdict across all IOCs in that alert.

---

## Rate limiting strategy

VirusTotal free tier (4 req/min) is the binding constraint. When an alert contains multiple IOCs, soc-triage processes them sequentially with a 15-second wait between VirusTotal calls. AbuseIPDB and MalwareBazaar are called in parallel with VirusTotal for the same IOC (same request cycle, not subject to the VirusTotal rate limit).

For high-volume environments, upgrading to a VirusTotal paid tier removes the rate limit concern. The 15-second Wait node can be removed or reduced accordingly.
