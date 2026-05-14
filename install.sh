#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════════════╗
# ║                  mini-soc — fast installer                      ║
# ║  Usage : ./install.sh                                           ║
# ║  Options: --mode dev | docker | full | wazuh                    ║
# ║           --env <file>   (chemin vers un .env existant)         ║
# ║           --skip-db      (ne pas appliquer le schema SQL)       ║
# ╚══════════════════════════════════════════════════════════════════╝
set -euo pipefail

# ── Couleurs ────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

ok()   { echo -e "${GREEN}✓${RESET} $*"; }
info() { echo -e "${CYAN}→${RESET} $*"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $*"; }
err()  { echo -e "${RED}✗${RESET} $*" >&2; }
step() { echo -e "\n${BOLD}${CYAN}[$1]${RESET} $2"; }

# ── Arguments ────────────────────────────────────────────────────────────────
MODE=""
ENV_FILE=".env.local"
SKIP_DB=false

while [[ $# -gt 0 ]]; do
  case $1 in
    --mode)   MODE="$2";     shift 2 ;;
    --env)    ENV_FILE="$2"; shift 2 ;;
    --skip-db) SKIP_DB=true; shift   ;;
    *)        shift ;;
  esac
done

# ── Bannière ─────────────────────────────────────────────────────────────────
echo -e "${BOLD}"
echo "  ███╗   ███╗██╗███╗   ██╗██╗    ███████╗ ██████╗  ██████╗"
echo "  ████╗ ████║██║████╗  ██║██║    ██╔════╝██╔═══██╗██╔════╝"
echo "  ██╔████╔██║██║██╔██╗ ██║██║    ███████╗██║   ██║██║"
echo "  ██║╚██╔╝██║██║██║╚██╗██║██║    ╚════██║██║   ██║██║"
echo "  ██║ ╚═╝ ██║██║██║ ╚████║██║    ███████║╚██████╔╝╚██████╗"
echo "  ╚═╝     ╚═╝╚═╝╚═╝  ╚═══╝╚═╝    ╚══════╝ ╚═════╝  ╚═════╝"
echo -e "${RESET}"
echo -e "  ${CYAN}Security Operations Center — fast installer${RESET}"
echo ""

# ── Vérification des prérequis ───────────────────────────────────────────────
step "1/5" "Vérification des prérequis"

check_cmd() {
  if command -v "$1" &>/dev/null; then
    ok "$1 $(command -v "$1")"
    return 0
  else
    return 1
  fi
}

HAS_DOCKER=false; HAS_NODE=false; HAS_SUPABASE=false; HAS_OPENSSL=false

check_cmd docker   && HAS_DOCKER=true   || warn "docker non trouvé — modes Docker indisponibles"
check_cmd node     && HAS_NODE=true     || warn "node non trouvé   — modes npm indisponibles"
check_cmd openssl  && HAS_OPENSSL=true  || true
check_cmd supabase && HAS_SUPABASE=true || true

if [[ "$HAS_DOCKER" == false && "$HAS_NODE" == false ]]; then
  err "Docker ou Node.js est requis. Installer au moins l'un des deux."
  exit 1
fi

# ── Choix du mode ────────────────────────────────────────────────────────────
step "2/5" "Choix du mode de lancement"

if [[ -z "$MODE" ]]; then
  echo ""
  echo "  Modes disponibles :"
  [[ "$HAS_NODE"   == true ]] && echo "    1) dev     — npm run dev  (hot-reload, Supabase cloud, n8n Docker)"
  [[ "$HAS_NODE"   == true ]] && echo "    2) prod    — npm start    (build prod local, n8n Docker)"
  [[ "$HAS_DOCKER" == true ]] && echo "    3) docker  — App en Docker seule + n8n Docker"
  [[ "$HAS_DOCKER" == true ]] && echo "    4) full    — Dashboard + n8n dans docker-compose (recommandé)"
  [[ "$HAS_DOCKER" == true ]] && echo "    5) wazuh   — Full + Wazuh Manager/Indexer/Dashboard"
  echo ""
  read -rp "  Choix [1-5] : " CHOICE
  case "$CHOICE" in
    1) MODE="dev"    ;;
    2) MODE="prod"   ;;
    3) MODE="docker" ;;
    4) MODE="full"   ;;
    5) MODE="wazuh"  ;;
    *) err "Choix invalide."; exit 1 ;;
  esac
fi

ok "Mode sélectionné : ${BOLD}$MODE${RESET}"

# ── Configuration des variables d'environnement ──────────────────────────────
step "3/5" "Configuration des variables d'environnement"

if [[ -f "$ENV_FILE" ]]; then
  ok ".env.local déjà présent — chargement des valeurs existantes"
  # shellcheck disable=SC1090
  set -a; source "$ENV_FILE"; set +a
else
  info "Création de $ENV_FILE"
  cp .env.example "$ENV_FILE"

  echo ""
  echo -e "  ${YELLOW}Renseigner les variables requises :${RESET}"
  echo -e "  ${CYAN}(Supabase → Project Settings → API)${RESET}"
  echo ""

  prompt_var() {
    local var="$1" label="$2" default="${3:-}"
    local current
    current=$(grep -E "^${var}=" "$ENV_FILE" | cut -d= -f2- | tr -d '"' || true)
    if [[ -n "$current" && "$current" != *"required"* && "$current" != *"[required]"* ]]; then
      ok "$var déjà défini"
      return
    fi
    if [[ -n "$default" ]]; then
      read -rp "  $label [$default] : " val
      val="${val:-$default}"
    else
      read -rp "  $label : " val
    fi
    # Remplacer la valeur dans le fichier
    if grep -q "^${var}=" "$ENV_FILE"; then
      sed -i.bak "s|^${var}=.*|${var}=${val}|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
    else
      echo "${var}=${val}" >> "$ENV_FILE"
    fi
    export "${var}=${val}"
  }

  prompt_var "NEXT_PUBLIC_SUPABASE_URL"   "Supabase Project URL"
  prompt_var "NEXT_PUBLIC_SUPABASE_ANON_KEY" "Supabase anon key"
  prompt_var "SUPABASE_SERVICE_KEY"       "Supabase service_role key"
  prompt_var "DASHBOARD_PASSWORD"         "Mot de passe dashboard"

  # Générer DASHBOARD_SECRET automatiquement si openssl est disponible
  if [[ "$HAS_OPENSSL" == true ]]; then
    SECRET=$(openssl rand -hex 32)
    sed -i.bak "s|^DASHBOARD_SECRET=.*|DASHBOARD_SECRET=${SECRET}|" "$ENV_FILE" && rm -f "${ENV_FILE}.bak"
    export DASHBOARD_SECRET="$SECRET"
    ok "DASHBOARD_SECRET généré automatiquement"
  else
    prompt_var "DASHBOARD_SECRET" "JWT secret (32+ caractères aléatoires)"
  fi

  prompt_var "N8N_API_URL" "n8n API URL" "http://localhost:5678"
  prompt_var "N8N_API_KEY" "n8n API key (laisser vide pour configurer plus tard)" ""
fi

ok "$ENV_FILE configuré"

# ── Application du schéma Supabase ───────────────────────────────────────────
step "4/5" "Schéma Supabase"

if [[ "$SKIP_DB" == true ]]; then
  warn "Skipping (--skip-db)"
elif [[ "$HAS_SUPABASE" == true ]]; then
  info "supabase CLI détectée — application des migrations"
  if supabase db push --linked 2>/dev/null; then
    ok "Migrations appliquées via supabase CLI"
  else
    warn "supabase db push a échoué (projet non lié ?)."
    warn "Appliquer manuellement : supabase/migrations/001_init.sql dans le SQL Editor"
    warn "  → https://supabase.com/dashboard/project/_/sql"
  fi
else
  warn "supabase CLI non installée."
  echo ""
  echo -e "  ${YELLOW}Appliquer le schéma manuellement :${RESET}"
  echo -e "  1. Ouvrir ${CYAN}https://supabase.com/dashboard/project/_/sql${RESET}"
  echo -e "  2. Coller et exécuter le contenu de ${BOLD}supabase/migrations/001_init.sql${RESET}"
  echo ""
  read -rp "  Appuyer sur Entrée une fois le SQL appliqué..." _
  ok "Schéma confirmé"
fi

# ── Démarrage des services ───────────────────────────────────────────────────
step "5/5" "Démarrage des services"

case "$MODE" in

  dev)
    info "Installation des dépendances npm..."
    npm install --silent
    ok "Dépendances installées"
    info "Démarrage de n8n..."
    docker compose up -d
    ok "n8n démarré → http://localhost:5678"
    echo ""
    echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo -e "  ${BOLD}Installation terminée !${RESET}"
    echo ""
    echo -e "  Lancer le dashboard :"
    echo -e "  ${CYAN}npm run dev${RESET}  →  http://localhost:3000"
    echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    ;;

  prod)
    info "Installation des dépendances npm..."
    npm install --silent
    ok "Dépendances installées"
    info "Build de production..."
    npm run build
    ok "Build terminé"
    info "Démarrage de n8n..."
    docker compose up -d
    ok "n8n démarré → http://localhost:5678"
    echo ""
    echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo -e "  ${BOLD}Installation terminée !${RESET}"
    echo ""
    echo -e "  Lancer le dashboard :"
    echo -e "  ${CYAN}npm start${RESET}  →  http://localhost:3000"
    echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    ;;

  docker)
    info "Build de l'image Docker..."
    docker build -t mini-soc .
    ok "Image mini-soc construite"
    info "Démarrage du container dashboard..."
    docker rm -f mini-soc-dashboard 2>/dev/null || true
    docker run -d \
      --name mini-soc-dashboard \
      --env-file "$ENV_FILE" \
      -p 3000:3000 \
      mini-soc
    ok "Dashboard démarré → http://localhost:3000"
    info "Démarrage de n8n..."
    docker compose up -d
    ok "n8n démarré → http://localhost:5678"
    echo ""
    echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo -e "  ${BOLD}Installation terminée !${RESET}"
    echo ""
    echo -e "  Dashboard  →  ${CYAN}http://localhost:3000${RESET}"
    echo -e "  n8n        →  ${CYAN}http://localhost:5678${RESET}"
    echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    ;;

  full)
    info "Démarrage de tous les services (docker-compose.full.yaml)..."
    docker compose -f docker-compose.full.yaml up -d --build
    ok "Services démarrés"
    echo ""
    echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo -e "  ${BOLD}Installation terminée !${RESET}"
    echo ""
    echo -e "  Dashboard  →  ${CYAN}http://localhost:3000${RESET}"
    echo -e "  n8n        →  ${CYAN}http://localhost:5678${RESET}"
    echo ""
    echo -e "  Logs  :  ${CYAN}docker compose -f docker-compose.full.yaml logs -f${RESET}"
    echo -e "  Stop  :  ${CYAN}docker compose -f docker-compose.full.yaml down${RESET}"
    echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    ;;

  wazuh)
    info "Démarrage mini-soc (docker-compose.full.yaml)..."
    docker compose -f docker-compose.full.yaml up -d --build
    ok "Dashboard + n8n démarrés"
    echo ""
    info "Démarrage de Wazuh..."
    echo ""
    echo -e "  ${YELLOW}Wazuh nécessite une génération de certificats au premier démarrage.${RESET}"
    echo ""
    echo -e "  Commandes à exécuter (si wazuh-docker n'est pas encore cloné) :"
    echo -e "  ${CYAN}git clone https://github.com/wazuh/wazuh-docker.git${RESET}"
    echo -e "  ${CYAN}cd wazuh-docker && git checkout v4.9.0 && cd single-node${RESET}"
    echo -e "  ${CYAN}docker compose -f generate-indexer-certs.yml run --rm generator${RESET}"
    echo -e "  ${CYAN}docker compose up -d${RESET}"
    echo ""
    echo -e "  Ou utiliser le fichier de référence fourni :"
    echo -e "  ${CYAN}cat docker-compose.wazuh.yaml${RESET}"
    echo ""
    echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    echo -e "  ${BOLD}mini-soc démarré !${RESET}"
    echo ""
    echo -e "  Dashboard  →  ${CYAN}http://localhost:3000${RESET}"
    echo -e "  n8n        →  ${CYAN}http://localhost:5678${RESET}"
    echo -e "  Wazuh UI   →  ${CYAN}https://localhost (après démarrage Wazuh)${RESET}"
    echo ""
    echo -e "  Pour configurer l'intégration Wazuh → n8n :"
    echo -e "  Voir ${BOLD}README.md${RESET} section « Configurer Wazuh »"
    echo -e "${BOLD}${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"
    ;;
esac
