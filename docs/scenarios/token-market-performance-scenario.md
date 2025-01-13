# Token Market Performance Scenario

## Overview
This scenario involves an AI agent performing a comprehensive analysis of a cryptocurrency token. The agent leverages data from APIs such as Messari or other cryptocurrency data providers to evaluate the token’s economics, market performance, and potential risks. By integrating data-driven insights with benchmarks, the agent provides actionable recommendations for investors, developers, or other stakeholders.

---

## Scenario Components

### Objectives
- Analyze the tokenomics of the target cryptocurrency.
- Track token price movements, trading volume, and liquidity.
- Assess market depth and potential risks, such as rug pulls or scams.
- Evaluate the token’s utility and use cases within its associated project.
- Compare the token’s performance against industry benchmarks and competitors.

### Participants
- **Primary Agent:** The AI agent conducting the analysis.
- **External Systems:** Cryptocurrency data providers (e.g., Messari, CoinGecko, or custom APIs).
- **Users (Optional):** Stakeholders reviewing the analysis, such as investors or developers.

### Initial Conditions
- Access to:
  - Relevant API credentials for cryptocurrency data providers.
  - Historical and real-time data on the token’s performance.
  - Project documentation or whitepapers describing token utility and use cases.
  - Benchmarks for comparative analysis.

### Expected Actions
1. **Tokenomics Analysis:**
   - Assess supply metrics, including circulating and total supply.
   - Evaluate distribution mechanisms (e.g., token allocation, vesting schedules).
   - Analyze inflation/deflation dynamics, such as staking rewards or token burns.
2. **Market Performance Tracking:**
   - Track price trends, trading volume, and market capitalization.
   - Identify significant price fluctuations or patterns.
3. **Liquidity and Market Depth Assessment:**
   - Evaluate liquidity across exchanges.
   - Analyze order books to assess market depth and slippage risk.
4. **Risk Identification:**
   - Monitor for signs of rug pulls, scams, or other malicious activities.
   - Analyze wallet distribution to identify potential centralization risks.
5. **Utility Evaluation:**
   - Review token use cases within its associated project.
   - Assess the practicality and adoption of the token’s utility.
6. **Benchmark Comparison:**
   - Compare the token’s performance against similar projects or industry benchmarks.
   - Highlight areas where the token excels or lags behind.

### Success Criteria
- Comprehensive analysis covering all key objectives.
- Identification of actionable insights, including risks and opportunities.
- Recommendations are benchmarked against similar tokens or industry standards.
- Data logged for future reference and further analysis.

---

## Run Lifecycle

### Initialization
- Set up API connections to cryptocurrency data providers.
- Load project-specific details, including tokenomics and utility descriptions.
- Retrieve historical and real-time data for analysis.

### Execution
- Sequentially execute the steps outlined in **Expected Actions**, ensuring comprehensive coverage.
- Simulate user interactions if applicable (e.g., requesting specific insights).

### Monitoring
- Log all agent actions, findings, and decisions for transparency.
- Monitor API usage to avoid rate limits or excessive costs.

### Termination
- End the run when all objectives are met or after a predefined time limit.
- Generate a detailed report summarizing findings and recommendations.

### Evaluation
- Assess the quality and depth of the agent’s analysis.
- Validate the accuracy and relevance of recommendations.
- Identify areas for improvement in the agent’s approach or data integration.

---

## Run Parameters
- **Time Constraints:** Define the maximum duration for analysis.
- **Resource Limits:** Limit API calls and computational resources.
- **Randomization Factors:** Optionally introduce variability, such as analyzing different market conditions or competitor tokens.

---

## Data Collection Requirements
- Tokenomics data, including supply, distribution, and mechanisms.
- Historical and real-time price data, trading volume, and liquidity metrics.
- Risk indicators, such as wallet distributions and market anomalies.
- Comparative metrics for benchmarks and competitors.
- Logs of all findings, actions, and recommendations.

---

## Integration with Eliza Framework
- **Actions:** Use cryptocurrency-related actions like `FETCH_TOKEN_DATA`, `ANALYZE_MARKET_DEPTH`, `COMPARE_BENCHMARKS`, and `IDENTIFY_RISKS`.
- **Providers:** Leverage providers for real-time market data, tokenomics, and project information.
- **Evaluators:** Assess findings using evaluators for token performance, utility, and risk.
- **Memory:** Log findings for future reference, enabling iterative improvements.

---

## Expected Impact
- Enable stakeholders to make informed decisions based on comprehensive token analysis.
- Identify risks and opportunities to guide investment or project development strategies.
- Provide benchmarks for ongoing monitoring and comparison with similar projects.
