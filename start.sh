#!/bin/bash

# APIForge - Start All Services Script
# Usage: ./start.sh [options]
# Options:
#   -d, --docker    Start with Docker
#   -l, --local     Start locally (default)
#   -h, --help      Show help

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_PORT=4000
WEB_PORT=3000
COUCHDB_PORT=5984

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

show_help() {
    echo "APIForge - Start All Services"
    echo ""
    echo "Usage: ./start.sh [options]"
    echo ""
    echo "Options:"
    echo "  -d, --docker    Start with Docker (requires Docker and Docker Compose)"
    echo "  -l, --local     Start locally (requires Node.js and CouchDB running)"
    echo "  -c, --couchdb   Start only CouchDB with Docker"
    echo "  -h, --help      Show this help message"
    echo ""
    echo "Examples:"
    echo "  ./start.sh -l              # Start web and API locally"
    echo "  ./start.sh -c             # Start CouchDB only"
    echo "  ./start.sh -d             # Start everything with Docker"
}

check_dependencies() {
    local deps=("$@")
    for dep in "${deps[@]}"; do
        if ! command -v "$dep" &> /dev/null; then
            log_error "Missing dependency: $dep"
            return 1
        fi
    done
    return 0
}

check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

wait_for_service() {
    local url=$1
    local name=$2
    local max_attempts=${3:-30}
    local attempt=1

    log_info "Waiting for $name to be ready..."

    while [ $attempt -le $max_attempts ]; do
        if curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null | grep -q "200\|404"; then
            log_success "$name is ready!"
            return 0
        fi
        sleep 1
        attempt=$((attempt + 1))
    done

    log_error "$name failed to start after $max_attempts seconds"
    return 1
}

start_couchdb_docker() {
    log_info "Starting CouchDB with Docker..."
    
    if docker ps --format '{{.Names}}' | grep -q "^apiforge-couchdb$"; then
        log_warning "CouchDB container already running"
        return 0
    fi

    docker run -d \
        --name apiforge-couchdb \
        -p $COUCHDB_PORT:5984 \
        -e COUCHDB_USER=admin \
        -e COUCHDB_PASSWORD=password \
        couchdb:3

    wait_for_service "http://localhost:$COUCHDB_PORT" "CouchDB" 30
}

start_couchdb_local() {
    log_info "Checking CouchDB..."

    if check_port $COUCHDB_PORT; then
        log_success "CouchDB is already running on port $COUCHDB_PORT"
        return 0
    fi

    if command -v docker &> /dev/null; then
        start_couchdb_docker
    else
        log_error "CouchDB is not running on port $COUCHDB_PORT"
        log_info "Please start CouchDB manually or use Docker: docker run -d -p $COUCHDB_PORT:5984 -e COUCHDB_USER=admin -e COUCHDB_PASSWORD=password couchdb:3"
        return 1
    fi
}

start_api_local() {
    log_info "Starting API server on port $API_PORT..."

    if check_port $API_PORT; then
        log_warning "Something is already running on port $API_PORT"
        return 0
    fi

    cd "$(dirname "$0")"

    # Check if node_modules exists
    if [ ! -d "node_modules" ]; then
        log_info "Installing dependencies..."
        npm install
    fi

    # Start API in background
    npm run start:api &
    API_PID=$!

    log_info "API server started with PID $API_PID"

    # Wait for API to be ready
    wait_for_service "http://localhost:$API_PORT/api/health" "API" 30

    echo $API_PID > /tmp/apiforge-api.pid
    log_success "API server running on http://localhost:$API_PORT"
}

start_web_local() {
    log_info "Starting Web server on port $WEB_PORT..."

    if check_port $WEB_PORT; then
        log_warning "Something is already running on port $WEB_PORT"
        return 0
    fi

    cd "$(dirname "$0")"

    # Start Web in background
    npm run start:web &
    WEB_PID=$!

    log_info "Web server started with PID $WEB_PID"

    # Wait for Web to be ready
    wait_for_service "http://localhost:$WEB_PORT" "Web" 60

    echo $WEB_PID > /tmp/apiforge-web.pid
    log_success "Web server running on http://localhost:$WEB_PORT"
}

start_docker() {
    log_info "Starting all services with Docker..."

    cd "$(dirname "$0")/docker"

    if [ ! -f ".env" ] && [ -f "../.env.example" ]; then
        log_info "Creating .env file from example..."
        cp ../.env.example .env
    fi

    docker-compose up -d

    log_info "Waiting for services to be ready..."
    sleep 10

    wait_for_service "http://localhost/api/health" "API" 60

    log_success "All services started!"
    log_info "Access the application at http://localhost"
    log_info "API available at http://localhost/api"
    log_info "CouchDB available at http://localhost:5984"
}

stop_docker() {
    log_info "Stopping Docker services..."
    cd "$(dirname "$0")/docker"
    docker-compose down
    log_success "Docker services stopped"
}

stop_local() {
    log_info "Stopping local services..."

    if [ -f /tmp/apiforge-api.pid ]; then
        kill $(cat /tmp/apiforge-api.pid) 2>/dev/null || true
        rm /tmp/apiforge-api.pid
        log_info "API server stopped"
    fi

    if [ -f /tmp/apiforge-web.pid ]; then
        kill $(cat /tmp/apiforge-web.pid) 2>/dev/null || true
        rm /tmp/apiforge-web.pid
        log_info "Web server stopped"
    fi

    log_success "Local services stopped"
}

cleanup() {
    log_info "Cleaning up..."
    stop_local
    docker stop apiforge-couchdb 2>/dev/null || true
    docker rm apiforge-couchdb 2>/dev/null || true
    log_success "Cleanup complete"
}

# Parse arguments
MODE="local"

while [[ $# -gt 0 ]]; do
    case $1 in
        -d|--docker)
            MODE="docker"
            shift
            ;;
        -l|--local)
            MODE="local"
            shift
            ;;
        -c|--couchdb)
            MODE="couchdb"
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            log_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Trap for cleanup
trap cleanup EXIT INT TERM

# Main execution
case $MODE in
    docker)
        start_docker
        log_info "Press Ctrl+C to stop..."
        tail -f /dev/null 2>/dev/null || true
        ;;
    couchdb)
        start_couchdb_local
        ;;
    local)
        start_couchdb_local
        start_api_local
        start_web_local
        
        log_success ""
        log_success "========================================"
        log_success "  APIForge is running!"
        log_success "========================================"
        log_success ""
        log_success "  Web UI:    http://localhost:$WEB_PORT"
        log_success "  API:       http://localhost:$API_PORT"
        log_success "  CouchDB:   http://localhost:$COUCHDB_PORT"
        log_success ""
        log_info "Press Ctrl+C to stop..."
        
        # Wait for Ctrl+C
        wait
        ;;
esac
