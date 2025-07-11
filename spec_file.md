# Claude-Flow Hybrid AI Trading Platform Development Prompt

## Project Overview
Build a hybrid AI-orchestrated trading platform where Claude acts as the strategic orchestrator while cheaper/free LLMs handle high-volume data processing. The system will analyze thousands of news sources, self-train on market patterns, and execute automated trading decisions with intelligent cost optimization.

## System Architecture Philosophy
- **Claude (via claude-flow)**: Strategic orchestrator and critical decision maker (CEO)
- **Local/Cheap LLMs**: High-volume data processors (Worker bees)
- **Traditional Algorithms**: Execution layer for speed and reliability
- **Neural Networks**: Pattern recognition and self-learning

## Initialize Claude-Flow Project

```bash
# Install and initialize claude-flow with full features
npx claude-flow@alpha init --claude --webui --force ai-trading-platform

# Configure swarm for hybrid AI architecture
npx claude-flow@alpha coordination swarm-init \
  --topology hierarchical \
  --max-agents 12 \
  --strategy hybrid-ai-trading

# Spawn specialized agents with different model backends
npx claude-flow@alpha coordination agent-spawn --type orchestrator --name "TradingCEO" --model "claude-opus-4"
npx claude-flow@alpha coordination agent-spawn --type analyst --name "NewsAnalyzer" --model "llama3-local"
npx claude-flow@alpha coordination agent-spawn --type analyst --name "SentimentTracker" --model "mistral-local"
npx claude-flow@alpha coordination agent-spawn --type analyst --name "MarketScanner" --model "deepseek-api"
npx claude-flow@alpha coordination agent-spawn --type coder --name "StrategyOptimizer" --model "codellama-local"
npx claude-flow@alpha coordination agent-spawn --type analyst --name "RiskAssessor" --model "phi3-local"
```

## SPARC Development Phases

### Phase 1: Research & Architecture

```bash
# Research hybrid AI trading architectures
npx claude-flow@alpha sparc researcher "Research hybrid AI trading systems with:
1. Cost-effective LLM orchestration patterns
2. Local LLM deployment (Ollama, LM Studio)
3. News sentiment analysis at scale
4. Self-training neural networks for trading
5. Real-time decision escalation frameworks"

# Store critical configuration
npx claude-flow@alpha memory store "architecture_type" "hybrid_ai_orchestration"
npx claude-flow@alpha memory store "primary_models" "claude_orchestrator_local_llm_workers"
npx claude-flow@alpha memory store "cost_target" "under_10_dollars_per_day"
```

### Phase 2: Infrastructure Design

```bash
# Design the hybrid system architecture
npx claude-flow@alpha sparc architect "Design hybrid AI trading platform with:

ORCHESTRATION LAYER (Claude via claude-flow):
- Strategic decision maker (10-20 calls/day max)
- Anomaly response and critical trade authorization
- Strategy adjustment based on performance
- Risk override decisions

DATA PROCESSING LAYER (Local/Cheap LLMs):
- Ollama server running Llama 3.2 for news analysis
- Mistral 7B for sentiment extraction
- Phi-3 for technical indicator interpretation
- DeepSeek API for complex market analysis ($0.14/M tokens)

EXECUTION LAYER (Traditional):
- Direct Alpaca API integration
- Sub-millisecond order execution
- Position management without AI overhead
- Real-time portfolio tracking

LEARNING LAYER:
- PyTorch neural networks for pattern recognition
- Self-training on trade outcomes
- Continuous strategy optimization"
```

### Phase 3: Local LLM Infrastructure

```bash
# Implement local LLM processing system
npx claude-flow@alpha sparc coder "Build local LLM infrastructure:

1. Ollama Setup:
   - Install Ollama server
   - Pull models: llama3.2, mistral, phi3
   - Create model rotation for load balancing
   - Implement health monitoring

2. News Processing Pipeline:
   - RSS/API feed aggregators (Bloomberg, Reuters, Reddit)
   - Queue system (Redis) for article distribution
   - Parallel processing across local models
   - Result aggregation and scoring

3. Prompt Templates:
   - Standardized prompts for consistency
   - Chain-of-thought for complex analysis
   - Output parsing to structured JSON"
```

### Phase 4: Orchestration Logic

```bash
# Build Claude orchestration layer
npx claude-flow@alpha sparc coder "Implement Claude orchestration:

1. Decision Escalation Framework:
   - Define thresholds for Claude involvement
   - Sentiment volatility > 3 standard deviations
   - Position size > 5% of portfolio
   - New strategy activation
   - Risk limit approaching

2. Orchestration API:
   - RESTful endpoints for agent communication
   - WebSocket for real-time coordination
   - State management in Redis
   - Decision logging for training

3. Cost Management:
   - Token usage tracking
   - Daily budget enforcement
   - Fallback to local models if budget exceeded
   - Performance vs cost optimization"
```

### Phase 5: Trading Core Implementation

```bash
# Build the actual trading system
npx claude-flow@alpha sparc coder "Create trading engine with:

1. Market Data Integration:
   - Alpaca WebSocket for real-time data
   - Historical data storage (TimescaleDB)
   - Technical indicator calculation
   - Multi-timeframe analysis

2. Signal Generation:
   - Combine LLM sentiment with technical indicators
   - Weight signals based on confidence scores
   - Backtesting framework integration
   - A/B testing for strategies

3. Execution Management:
   - Position sizing algorithms
   - Risk management (stop-loss, take-profit)
   - Order types (market, limit, trailing)
   - Slippage and fee calculations"
```

### Phase 6: Neural Learning System

```bash
# Implement self-training neural networks
npx claude-flow@alpha sparc coder "Build neural learning system:

1. Data Collection:
   - Trade outcomes (profit/loss)
   - Market conditions at entry/exit
   - News sentiment at trade time
   - Technical indicators used

2. Neural Architecture:
   - LSTM for time series prediction
   - Transformer for news impact modeling
   - Reinforcement learning for strategy optimization
   - Ensemble methods for robustness

3. Training Pipeline:
   - Nightly training runs
   - Incremental learning from new trades
   - Model versioning and rollback
   - Performance validation before deployment"

# Configure neural training
npx claude-flow@alpha neural train --pattern trading-decisions --epochs 100
npx claude-flow@alpha cognitive analyze --behavior "news-price-correlation"
```

### Phase 7: Monitoring & Optimization

```bash
# Build comprehensive monitoring
npx claude-flow@alpha sparc coder "Create monitoring dashboard:

1. Real-time Metrics:
   - P&L tracking
   - Model performance (each LLM)
   - Latency measurements
   - Cost per decision

2. Claude Usage Analytics:
   - Tokens used vs budget
   - Decision impact analysis
   - ROI on Claude calls
   - Escalation patterns

3. System Health:
   - Local LLM server status
   - API rate limits
   - Memory usage
   - Queue depths"
```

## Example Workflow

```python
# Pseudo-code for the complete flow

# 1. News arrives (1000s per hour)
news = fetch_news_feeds()

# 2. Local Llama processes in parallel (FREE)
sentiments = local_llama.batch_analyze(news)  # Cost: $0

# 3. Aggregate and detect anomalies
if sentiments.volatility > THRESHOLD:
    # 4. Escalate to DeepSeek for deeper analysis (CHEAP)
    analysis = deepseek_api.analyze_market_impact(sentiments)  # Cost: ~$0.01
    
    # 5. If critical, escalate to Claude (EXPENSIVE BUT RARE)
    if analysis.requires_strategic_decision:
        decision = claude_flow.orchestrate({
            "sentiment": sentiments,
            "analysis": analysis,
            "portfolio": current_positions,
            "risk": risk_metrics
        })  # Cost: ~$0.10
        
        # 6. Execute via traditional systems (FAST)
        if decision.action == "TRADE":
            alpaca_api.place_order(decision.orders)  # Cost: $0
```

## Cost Optimization Strategy

```bash
# Configure cost limits
npx claude-flow@alpha config cost-limits \
  --claude-daily-max 5.00 \
  --deepseek-daily-max 2.00 \
  --fallback-strategy "local-only"

# Implement tiered decision making
npx claude-flow@alpha hooks pre-orchestrate \
  --check-daily-budget \
  --estimate-token-cost \
  --approve-if-under-threshold
```

## Deployment Configuration

```bash
# Setup production environment
npx claude-flow@alpha deploy configure \
  --ollama-gpu-server "local-rtx4090" \
  --redis-cluster "cache.trading.internal" \
  --timescaledb "tsdb.trading.internal" \
  --alpaca-env "paper" \  # Start with paper trading
  --monitoring "grafana"
```

## Security & Risk Management

```bash
# Implement safety measures
npx claude-flow@alpha sparc coder "Add safety systems:
1. Maximum position limits
2. Daily loss limits
3. Claude override authority
4. Automatic strategy suspension
5. Human notification system
6. Audit logging for compliance"
```

## Launch Sequence

```bash
# Start the complete system
npx claude-flow@alpha coordination task-orchestrate \
  --task "Launch hybrid AI trading platform" \
  --sequence "
    1. Start Ollama servers
    2. Initialize Redis queues  
    3. Connect news feeds
    4. Warm up local models
    5. Test Claude orchestration
    6. Enable paper trading
    7. Begin learning phase
  " \
  --monitor real-time \
  --auto-optimize true
```

## Expected Outcomes

- **News Processing**: 10,000+ articles/day at near-zero cost
- **Claude Usage**: 10-20 strategic decisions/day (~$5)
- **Total Cost**: < $10/day for complete AI orchestration
- **Latency**: <100ms for local decisions, <5s for Claude decisions
- **Scalability**: Can add more local GPUs as needed

This hybrid approach leverages Claude's intelligence where it matters most while using free/cheap models for the heavy lifting, creating a practical and cost-effective AI trading system.