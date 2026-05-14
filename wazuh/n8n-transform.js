/**
 * n8n Code node — transformer une alerte Wazuh en ligne alert_queue Supabase.
 *
 * Placer ce code dans un noeud "Code" du workflow n8n "soc-ingest",
 * après le noeud Webhook qui reçoit les alertes du script custom-n8n.
 *
 * Connexion suivante : noeud Supabase "Insert Row" sur la table alert_queue.
 */

const alert = $input.first().json;

const rule     = alert.rule     || {};
const agent    = alert.agent    || {};
const data     = alert.data     || {};
const syscheck = alert.syscheck || {};

// ── Extraction des IOCs ──────────────────────────────────────────────────────
const iocs = alert.iocs || [];  // déjà extraits par le script Python

// Si le script Python n'a pas fourni d'IOCs (appel direct sans le script),
// on les extrait ici en fallback.
if (iocs.length === 0) {
  if (data.srcip)               iocs.push({ value: data.srcip,              type: 'ip',   verdict: 'SUSPICIOUS' });
  if (data.dstip)               iocs.push({ value: data.dstip,              type: 'ip',   verdict: 'SUSPICIOUS' });
  if (data.url)                 iocs.push({ value: data.url,                type: 'url',  verdict: 'SUSPICIOUS' });
  if (syscheck.sha256_after)    iocs.push({ value: syscheck.sha256_after,   type: 'hash', verdict: 'SUSPICIOUS' });
  if (syscheck.md5_after)       iocs.push({ value: syscheck.md5_after,      type: 'hash', verdict: 'SUSPICIOUS' });
  const vt = (data.virustotal || {}).source || {};
  if (vt.md5)                   iocs.push({ value: vt.md5,                  type: 'hash', verdict: 'MALICIOUS'  });
}

// ── Clé de déduplication ─────────────────────────────────────────────────────
// Format : <wazuh_alert_id>:<agent_id>  →  garantit l'unicité par événement
const dedup_key = alert.dedup_key
  || `${alert.id || Date.now()}:${agent.id || '000'}`;

// ── Construction de la ligne alert_queue ─────────────────────────────────────
return [{
  json: {
    dedup_key,
    raw_alert:  alert.raw_alert || alert,
    rule_id:    rule.id   || null,
    rule_level: rule.level || 0,
    rule_desc:  rule.description || null,
    agent_name: agent.name || null,
    agent_ip:   agent.ip   || null,
    username:   data.srcuser || data.dstuser || null,
    command:    (alert.raw_alert || alert).full_log || null,
    iocs:       JSON.stringify(iocs),
    status:     'pending',
  }
}];
