#!/bin/bash

# Claude-Flow Docker Wrapper Script
# Makes it easy to use claude-flow in Docker

CONTAINER_NAME="claude-flow-dev-secure"

# Check if container is running
if ! docker ps --format "table {{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    echo "🚀 Starting Claude-Flow Docker environment..."
    ./docker-secure-start.sh dev
    echo "✅ Environment ready!"
    echo ""
fi

# If no arguments provided, show help
if [ $# -eq 0 ]; then
    echo "🧠 Claude-Flow Docker Wrapper"
    echo ""
    echo "Usage:"
    echo "  $0 <claude-flow-command>     # Run claude-flow command in Docker"
    echo "  $0 shell                     # Enter interactive shell"
    echo "  $0 logs                      # View container logs"
    echo ""
    echo "Examples:"
    echo "  $0 status                    # Show system status"
    echo "  $0 start --ui                # Start with UI"
    echo "  $0 agent spawn researcher    # Spawn researcher agent"
    echo "  $0 sparc modes               # List SPARC modes"
    echo "  $0 shell                     # Interactive shell"
    echo ""
    exit 0
fi

# Special commands
case "$1" in
    "shell")
        echo "🐚 Entering Claude-Flow Docker shell..."
        docker exec -it $CONTAINER_NAME bash
        ;;
    "logs")
        docker logs $CONTAINER_NAME --tail 50 -f
        ;;
    *)
        # Run claude-flow command
        docker exec $CONTAINER_NAME npx claude-flow "$@"
        ;;
esac