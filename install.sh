#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║                  mini-soc — fast installer                      ║
# ║  Usage : ./install.sh                                           ║
# ║  Options: --mode dev | prod | docker | full | wazuh             ║
# ║           --env <file>   chemin vers un .env existant           ║
# ║           --skip-db      ne pas appliquer le schéma SQL         ║
# ║  CI/env vars: MINI_SOC_MODE, MINI_SOC_ENV_FILE                  ║
# ╚══════════════════════════════════════════════════════════════════╝
set -euo pipefail
IFS=$'\n\t'

# ════════════════════════════════════════════════════════════════════════════
#  SECTION 1 — Fonctions utilitaires (toutes définies avant usage)
# ════════════════════════════════════════════════════════════════════════════

# ── Couleurs (désactivées si pas de TTY) ────────────────────────────────────
if [[ -t 1 ]]; then
  RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
  CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; RESET='\033[0m'
else
  RED=''; GREEN=''; YELLOW=''; CYAN=''; BOLD=''; DIM=''; RESET=''
fi

ok()   { echo -e "${GREEN}✓${RESET} $*"; }
info() { echo -e "${CYAN}→${RESET} $*"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $*"; }
err()  { echo -e "${RED}✗${RESET} $*" >&2; }
die()  { err "$*"; exit 1; }
step() { echo -e "\n${BOLD}${CYAN}[$1]${RESET} ${BOLD}$2${RESET}"; }

# ── Nettoyage sur sortie inattendue ─────────────────────────────────────────
cleanup() {
  local code=$?
  if [[ $code -ne 0 ]]; then
    echo -e "\n${RED}Installation interrompue (code $code).${RESET}" >&2
    echo -e "  Relancer avec ${CYAN}./install.sh${RESET} pour recommencer." >&2
  fi
}
trap cleanup EXIT

# ── sed portable (macOS BSD sed vs GNU sed Linux) ────────────────────────────
sed_i() {
  if sed --version 2>/dev/null | grep -q GNU; then
    sed -i "$@"
  else
    sed -i '' "$@"
  fi
}

# ── Chargement sûr d'un .env (sans source, sans exécution de code) ──────────
load_env() {
  local env_file="$1"
  [[ -f "$env_file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    [[ "$line" != *=*             ]] && continue
    local key="${line%%=*}"
    local value="${line#*=}"
    [[ "$key" =~ ^[a-zA-Z_][a-zA-Z0-9_]*$ ]] || continue
    if   [[ "$value" =~ ^\"(.*)\"$ ]]; then value="${BASH_REMATCH[1]}"
    elif [[ "$value" =~ ^\'(.*)\'$ ]]; then value="${BASH_REMATCH[1]}"
    fi
    printf -v "$key" '%s' "$value"
    export "$key"
  done < "$env_file"
}

# ── Lire une valeur depuis un .env sans le sourcer ───────────────────────────
get_env_var() {
  local key="$1" file="$2"
  grep -E "^${key}=" "$file" 2>/dev/null | head -1 | cut -d= -f2- \
    | sed "s/^['\"]//;s/['\"]$//" || true
}

# ── Écrire/mettre à jour une variable dans un .env ───────────────────────────
set_env_var() {
  local key="$1" value="$2" file="$3"
  # Échapper les caractères spéciaux pour sed (côté remplacement)
  local esc_value
  esc_value=$(printf '%s' "$value" | sed 's/[&/\]/\\&/g')
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    sed_i "s|^${key}=.*|${key}=${esc_value}|" "$file"
  else
    echo "${key}=${value}" >> "$file"
  fi
  export "${key}=${value}"
}

# ── Prompt sécurisé, respecte mode non-interactif ───────────────────────────
# Usage: prompt_var KEY "Label" "default" [secret]
prompt_var() {
  local key="$1" label="$2" default="${3:-}" secret="${4:-}"
  local current
  current=$(get_env_var "$key" "$ENV_FILE")

  # Déjà défini avec une vraie valeur → skip
  if [[ -n "$current" && "$current" != *"[required]"* && "$current" != *"required"* ]]; then
    ok "${key} déjà défini"
    export "${key}=${current}"
    return 0
  fi

  # Mode non-interactif
  if [[ "$INTERACTIVE" == false ]]; then
    if [[ -n "$default" ]]; then
      set_env_var "$key" "$default" "$ENV_FILE"
      warn "${key} non défini → valeur par défaut : ${default}"
    else
      die "${key} est requis. Définir dans ${ENV_FILE} avant de relancer."
    fi
    return 0
  fi

  # Prompt interactif
  local prompt_label="${label}"
  [[ -n "$default" ]] && prompt_label="${label} ${DIM}[${default}]${RESET}"

  local val=""
  if [[ "$secret" == "secret" ]]; then
    read -rsp "  ${prompt_label} : " val || true
    echo ""
  else
    read -rp  "  ${prompt_label} : " val || true
  fi
  val="${val:-$default}"

  [[ -z "$val" ]] && die "${key} est requis et ne peut pas être vide."
  set_env_var "$key" "$val" "$ENV_FILE"
}

# ── Détection docker compose v2 / fallback v1 ───────────────────────────────
detect_compose() {
  if docker compose version &>/dev/null; then
    COMPOSE_CMD="docker compose"
  elif command -v docker-compose &>/dev/null; then
    COMPOSE_CMD="docker-compose"
    warn "docker-compose v1 (EOL 2023) utilisé. Mettre à jour Docker Desktop."
  else
    die "Ni 'docker compose' ni 'docker-compose' trouvés. Installer Docker Desktop ou le plugin Compose."
  fi
  local ver
  ver=$(${COMPOSE_CMD} version --short 2>/dev/null || true)
  ok "Compose : ${COMPOSE_CMD}${ver:+ (${ver})}"
}

# ── Vérification que le daemon Docker répond ────────────────────────────────
check_docker_running() {
  if ! docker info &>/dev/null; then
    err "Le daemon Docker ne répond pas."
    echo -e "  ${YELLOW}macOS / Windows${RESET} : démarrer Docker Desktop" >&2
    echo -e "  ${YELLOW}Linux${RESET}            : sudo systemctl start docker" >&2
    exit 1
  fi
}

# ── Vérification de ports (lsof → ss → nc, par ordre de préférence) ─────────
port_in_use() {
  local port="$1"
  if command -v lsof &>/dev/null; then
    lsof -i :"$port" -sTCP:LISTEN -t &>/dev/null
  elif command -v ss &>/dev/null; then
    ss -tlnp 2>/dev/null | grep -q ":${port} " || false
  else
    nc -z -w1 localhost "$port" &>/dev/null
  fi
}

check_ports() {
  local blocked=()
  for port in "$@"; do
    if port_in_use "$port"; then
      blocked+=("$port")
    fi
  done
  if [[ ${#blocked[@]} -gt 0 ]]; then
    err "Port(s) déjà utilisé(s) : ${blocked[*]}"
    for p in "${blocked[@]}"; do
      local pid
      pid=$(lsof -i :"$p" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)
      [[ -n "$pid" ]] && echo -e "  Port ${p} → PID ${pid} ($(ps -p "$pid" -o comm= 2>/dev/null || echo 'inconnu'))" >&2
    done
    die "Libérer les ports ci-dessus et relancer le script."
  fi
}

# ── Afficher les instructions SQL manuelles ──────────────────────────────────
show_sql_instructions() {
  local sql_file="$1"
  warn "Appliquer le schéma SQL manuellement :"
  echo ""
  echo -e "  1. Ouvrir ${CYAN}https://supabase.com/dashboard/project/_/sql/new${RESET}"
  echo -e "  2. Coller et exécuter le contenu de ${BOLD}${sql_file}${RESET}"
  echo ""
  if [[ "$INTERACTIVE" == true ]]; then
    local confirm=""
    read -rp "  Appuyer sur Entrée une fois le SQL appliqué (ou 's' pour ignorer) : " confirm || true
    if [[ "${confirm:-}" == "s" ]]; then
      warn "Schéma ignoré — le dashboard ne fonctionnera pas sans les tables et fonctions RPC."
    else
      ok "Schéma confirmé"
    fi
  else
    warn "Mode non-interactif : schéma supposé déjà appliqué."
  fi
}

# ── Récapitulatif final ───────────────────────────────────────────────────────
print_summary() {
  local mode="$1"
  echo ""
  echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo -e "  ${BOLD}✓ Installation terminée${RESET}"
  echo ""
  local pw
  pw=$(get_env_var "DASHBOARD_PASSWORD" "$ENV_FILE")

  case "$mode" in
    dev)
      echo -e "  Lancer le dashboard :"
      echo -e "    ${CYAN}npm run dev${RESET}  →  http://localhost:3000"
      [[ -n "$pw" ]] && echo -e "    Mot de passe : ${BOLD}${pw}${RESET}"
      echo -e "  n8n  →  ${CYAN}http://localhost:5678${RESET}"
      ;;
    prod)
      echo -e "  Lancer le dashboard :"
      echo -e "    ${CYAN}npm start${RESET}  →  http://localhost:3000"
      [[ -n "$pw" ]] && echo -e "    Mot de passe : ${BOLD}${pw}${RESET}"
      echo -e "  n8n  →  ${CYAN}http://localhost:5678${RESET}"
      ;;
    docker|full)
      echo -e "  Dashboard  →  ${CYAN}http://localhost:3000${RESET}"
      [[ -n "$pw" ]] && echo -e "  Mot de passe  : ${BOLD}${pw}${RESET}"
      echo -e "  n8n        →  ${CYAN}http://localhost:5678${RESET}"
      echo ""
      local cf="docker-compose.full.yaml"
      [[ "$mode" == "docker" ]] && cf="docker-compose.yaml"
      echo -e "  ${DIM}Logs   : ${COMPOSE_CMD} -f ${cf} logs -f${RESET}"
      echo -e "  ${DIM}Arrêt  : ${COMPOSE_CMD} -f ${cf} down${RESET}"
      ;;
    wazuh)
      echo -e "  Dashboard  →  ${CYAN}http://localhost:3000${RESET}"
      [[ -n "$pw" ]] && echo -e "  Mot de passe  : ${BOLD}${pw}${RESET}"
      echo -e "  n8n        →  ${CYAN}http://localhost:5678${RESET}"
      echo ""
      echo -e "  ${YELLOW}Wazuh — étapes suivantes :${RESET}"
      echo -e "  ${DIM}git clone https://github.com/wazuh/wazuh-docker.git${RESET}"
      echo -e "  ${DIM}cd wazuh-docker && git checkout v4.9.0 && cd single-node${RESET}"
      echo -e "  ${DIM}docker compose -f generate-indexer-certs.yml run --rm generator${RESET}"
      echo -e "  ${DIM}docker compose up -d${RESET}"
      echo -e "  Wazuh UI   →  ${CYAN}https://localhost${RESET} (après démarrage)"
      echo -e "  Intégration →  voir ${BOLD}README.md${RESET} section « Configurer Wazuh »"
      ;;
  esac

  echo ""
  echo -e "  ${DIM}Config : ${ENV_FILE}${RESET}"
  echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
  echo ""
}

# ════════════════════════════════════════════════════════════════════════════
#  SECTION 2 — Lecture des arguments et état global
# ════════════════════════════════════════════════════════════════════════════

MODE="${MINI_SOC_MODE:-}"
ENV_FILE="${MINI_SOC_ENV_FILE:-.env.local}"
SKIP_DB=false
COMPOSE_CMD=""

while [[ $# -gt 0 ]]; do
  case $1 in
    --mode)     MODE="$2";     shift 2 ;;
    --env)      ENV_FILE="$2"; shift 2 ;;
    --skip-db)  SKIP_DB=true;  shift   ;;
    -h|--help)
      echo "Usage: ./install.sh [--mode dev|prod|docker|full|wazuh] [--env FILE] [--skip-db]"
      exit 0 ;;
    *) warn "Argument inconnu ignoré : $1"; shift ;;
  esac
done

INTERACTIVE=false
[[ -t 0 ]] && INTERACTIVE=true

# ════════════════════════════════════════════════════════════════════════════
#  BANNIÈRE
# ════════════════════════════════════════════════════════════════════════════
echo -e "${BOLD}"
echo "  ███╗   ███╗██╗███╗   ██╗██╗    ███████╗ ██████╗  ██████╗"
echo "  ████╗ ████║██║████╗  ██║██║    ██╔════╝██╔═══██╗██╔════╝"
echo "  ██╔████╔██║██║██╔██╗ ██║██║    ███████╗██║   ██║██║"
echo "  ██║╚██╔╝██║██║██║╚██╗██║██║    ╚════██║██║   ██║██║"
echo "  ██║ ╚═╝ ██║██║██║ ╚████║██║    ███████║╚██████╔╝╚██████╗"
echo "  ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝    ╚══════╝ ╚═════╝  ╚═════╝"
echo -e "${RESET}"
echo -e "  ${CYAN}Security Operations Center — fast installer${RESET}"
[[ "$INTERACTIVE" == false ]] && echo -e "  ${YELLOW}Mode non-interactif détecté (CI/pipe)${RESET}"
echo ""

# ════════════════════════════════════════════════════════════════════════════
#  ÉTAPE 1 — Prérequis
# ════════════════════════════════════════════════════════════════════════════
step "1/5" "Vérification des prérequis"

HAS_DOCKER=false
HAS_NODE=false
HAS_OPENSSL=false
HAS_SUPABASE=false

check_cmd() {
  local cmd="$1" flag="${2:-}"
  if command -v "$cmd" &>/dev/null; then
    local ver=""
    if [[ -n "$flag" ]]; then
      ver=" ($(${cmd} ${flag} 2>/dev/null | head -1 | tr -d '\n' || true))"
    fi
    ok "${cmd}${ver}"
    return 0
  fi
  return 1
}

check_cmd docker   "--version" && HAS_DOCKER=true   || warn "docker non trouvé"
check_cmd node     "--version" && HAS_NODE=true     || warn "node non trouvé"
check_cmd openssl  "version"   && HAS_OPENSSL=true  || true
check_cmd supabase "--version" && HAS_SUPABASE=true || true

if [[ "$HAS_DOCKER" == false && "$HAS_NODE" == false ]]; then
  die "Docker ou Node.js requis. Installer au moins l'un des deux et relancer."
fi

if [[ "$HAS_DOCKER" == true ]]; then
  check_docker_running
  detect_compose
fi

# ════════════════════════════════════════════════════════════════════════════
#  ÉTAPE 2 — Choix du mode
# ════════════════════════════════════════════════════════════════════════════
step "2/5" "Mode de lancement"

if [[ -z "$MODE" ]]; then
  if [[ "$INTERACTIVE" == false ]]; then
    die "Mode requis en non-interactif. Utiliser --mode dev|prod|docker|full|wazuh ou MINI_SOC_MODE=..."
  fi
  echo ""
  echo "  Modes disponibles :"
  [[ "$HAS_NODE"   == true ]] && echo "    ${BOLD}1)${RESET} dev     — npm run dev  (hot-reload)"
  [[ "$HAS_NODE"   == true ]] && echo "    ${BOLD}2)${RESET} prod    — npm start    (build prod local)"
  [[ "$HAS_DOCKER" == true ]] && echo "    ${BOLD}3)${RESET} docker  — App Docker seule + n8n"
  [[ "$HAS_DOCKER" == true ]] && echo "    ${BOLD}4)${RESET} full    — Dashboard + n8n docker compose ${GREEN}[recommandé]${RESET}"
  [[ "$HAS_DOCKER" == true ]] && echo "    ${BOLD}5)${RESET} wazuh   — Full + Wazuh stack"
  echo ""
  local_choice=""
  read -rp "  Choix [1-5] : " local_choice || true
  case "${local_choice:-}" in
    1) MODE="dev"    ;;
    2) MODE="prod"   ;;
    3) MODE="docker" ;;
    4) MODE="full"   ;;
    5) MODE="wazuh"  ;;
    *) die "Choix invalide : '${local_choice:-vide}'. Entrer 1, 2, 3, 4 ou 5." ;;
  esac
fi

case "$MODE" in
  dev|prod)
    [[ "$HAS_NODE"   == true ]] || die "Node.js requis pour le mode '${MODE}'."
    [[ "$HAS_DOCKER" == true ]] || die "Docker requis pour lancer n8n (mode '${MODE}')."
    ;;
  docker|full|wazuh)
    [[ "$HAS_DOCKER" == true ]] || die "Docker requis pour le mode '${MODE}'."
    ;;
  *) die "Mode inconnu : '${MODE}'. Valeurs acceptées : dev, prod, docker, full, wazuh." ;;
esac

ok "Mode sélectionné : ${BOLD}${MODE}${RESET}"

# ════════════════════════════════════════════════════════════════════════════
#  ÉTAPE 3 — Variables d'environnement
# ════════════════════════════════════════════════════════════════════════════
step "3/5" "Configuration des variables d'environnement"

if [[ -f "$ENV_FILE" ]]; then
  ok "${ENV_FILE} trouvé — chargement des valeurs existantes"
  load_env "$ENV_FILE"
else
  [[ -f ".env.example" ]] || die ".env.example introuvable. Vérifier que le repo est complet."
  info "Création de ${ENV_FILE} depuis .env.example"
  cp .env.example "$ENV_FILE"
fi

echo ""
echo -e "  ${YELLOW}Variables requises${RESET} ${DIM}(Supabase → Project Settings → API)${RESET}"
echo ""

prompt_var "NEXT_PUBLIC_SUPABASE_URL"      "Supabase Project URL"
prompt_var "NEXT_PUBLIC_SUPABASE_ANON_KEY" "Supabase anon key"         "" "secret"
prompt_var "SUPABASE_SERVICE_KEY"          "Supabase service_role key" "" "secret"
prompt_var "DASHBOARD_PASSWORD"            "Mot de passe dashboard"    "" "secret"

# DASHBOARD_SECRET — générer automatiquement si absent
current_secret=$(get_env_var "DASHBOARD_SECRET" "$ENV_FILE")
if [[ -z "$current_secret" || "$current_secret" == *"required"* ]]; then
  if [[ "$HAS_OPENSSL" == true ]]; then
    generated=$(openssl rand -hex 32)
    set_env_var "DASHBOARD_SECRET" "$generated" "$ENV_FILE"
    ok "DASHBOARD_SECRET généré automatiquement"
  else
    prompt_var "DASHBOARD_SECRET" "JWT secret (32+ caractères aléatoires)" "" "secret"
  fi
else
  ok "DASHBOARD_SECRET déjà défini"
fi

prompt_var "N8N_API_URL" "n8n API URL" "http://localhost:5678"

# N8N_API_KEY — optionnel au premier démarrage
current_n8n_key=$(get_env_var "N8N_API_KEY" "$ENV_FILE")
if [[ -z "$current_n8n_key" || "$current_n8n_key" == *"required"* ]]; then
  if [[ "$INTERACTIVE" == true ]]; then
    n8n_val=""
    read -rp "  n8n API key ${DIM}(vide = configurer plus tard)${RESET} : " n8n_val || true
    if [[ -n "$n8n_val" ]]; then
      set_env_var "N8N_API_KEY" "$n8n_val" "$ENV_FILE"
    else
      set_env_var "N8N_API_KEY" "" "$ENV_FILE"
      warn "N8N_API_KEY vide — workflow cards afficheront 'n8n unreachable'"
    fi
  else
    warn "N8N_API_KEY non défini — configurer dans ${ENV_FILE} après démarrage de n8n"
  fi
else
  ok "N8N_API_KEY déjà défini"
fi

echo ""
ok "${ENV_FILE} configuré"

# ════════════════════════════════════════════════════════════════════════════
#  ÉTAPE 4 — Schéma Supabase
# ════════════════════════════════════════════════════════════════════════════
step "4/5" "Schéma Supabase"

SQL_FILE="supabase/migrations/001_init.sql"

if [[ "$SKIP_DB" == true ]]; then
  warn "Ignoré (--skip-db)"
elif [[ ! -f "$SQL_FILE" ]]; then
  warn "${SQL_FILE} introuvable — vérifier que le repo est complet"
elif [[ "$HAS_SUPABASE" == true ]]; then
  info "supabase CLI détectée — tentative d'application des migrations"
  set +e
  supabase_out=$(supabase db push --linked 2>&1)
  supabase_rc=$?
  set -e
  if [[ $supabase_rc -eq 0 ]]; then
    ok "Migrations appliquées via supabase CLI"
  else
    warn "supabase db push a échoué (projet peut-être non lié)."
    echo -e "  ${DIM}$(echo "$supabase_out" | head -3)${RESET}"
    show_sql_instructions "$SQL_FILE"
  fi
else
  show_sql_instructions "$SQL_FILE"
fi

# ════════════════════════════════════════════════════════════════════════════
#  ÉTAPE 5 — Démarrage des services
# ════════════════════════════════════════════════════════════════════════════
step "5/5" "Démarrage des services"

# S'assurer que le dossier volume n8n existe (évite erreur de permission Docker)
mkdir -p n8n_data

case "$MODE" in

  dev)
    check_ports 3000 5678
    info "Installation des dépendances npm..."
    npm install --loglevel=error --no-audit --no-fund \
      || die "npm install a échoué. Vérifier la version Node.js (≥ 18) et les logs ci-dessus."
    ok "Dépendances installées"
    info "Démarrage de n8n..."
    $COMPOSE_CMD up -d \
      || die "Échec docker compose up. Logs : ${COMPOSE_CMD} logs n8n"
    ok "n8n démarré"
    print_summary "dev"
    ;;

  prod)
    check_ports 3000 5678
    info "Installation des dépendances npm..."
    npm install --loglevel=error --no-audit --no-fund \
      || die "npm install a échoué."
    ok "Dépendances installées"
    info "Build de production (peut prendre 1-2 min)..."
    npm run build --loglevel=error \
      || die "npm run build a échoué. Vérifier les erreurs TypeScript/lint ci-dessus."
    ok "Build terminé"
    info "Démarrage de n8n..."
    $COMPOSE_CMD up -d \
      || die "Échec docker compose up."
    ok "n8n démarré"
    print_summary "prod"
    ;;

  docker)
    check_ports 3000 5678
    info "Build de l'image Docker (2-3 min au premier build)..."
    docker build -t mini-soc . \
      || die "docker build a échoué. Vérifier le Dockerfile et les erreurs ci-dessus."
    ok "Image mini-soc construite"
    docker rm -f mini-soc-dashboard &>/dev/null || true
    info "Démarrage du container dashboard..."
    docker run -d \
      --name mini-soc-dashboard \
      --env-file "$ENV_FILE" \
      --restart unless-stopped \
      -p 3000:3000 \
      mini-soc \
      || die "docker run a échoué. Logs : docker logs mini-soc-dashboard"
    ok "Dashboard démarré"
    info "Démarrage de n8n..."
    $COMPOSE_CMD up -d \
      || die "Échec docker compose up."
    ok "n8n démarré"
    print_summary "docker"
    ;;

  full)
    check_ports 3000 5678
    info "Démarrage complet (docker-compose.full.yaml)..."
    $COMPOSE_CMD -f docker-compose.full.yaml up -d --build \
      || die "Échec docker compose up. Logs : ${COMPOSE_CMD} -f docker-compose.full.yaml logs"
    ok "Tous les services démarrés"
    print_summary "full"
    ;;

  wazuh)
    check_ports 3000 5678
    info "Démarrage mini-soc (docker-compose.full.yaml)..."
    $COMPOSE_CMD -f docker-compose.full.yaml up -d --build \
      || die "Échec docker compose up."
    ok "Dashboard + n8n démarrés"
    print_summary "wazuh"
    ;;

esac
