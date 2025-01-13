# Arbor’s Artistic Bounties Scenario

**Name:** Artistic Bounties

**Agent:** {{agentName}} (Note: This is a placeholder. In the actual implementation, `{{agentName}}` will be replaced with the specific agent designated to run this scenario, such as "Arbor" if you want to keep the association with the original concept. However, it is designed to be agent-agnostic, meaning any appropriately configured agent can run it.)

**Description:** This scenario showcases a creative contest hosted by an AI agent within a messaging platform (e.g., Telegram, Discord). The agent will announce an art contest, define the rules and theme, accept submissions from users, facilitate community voting (optional), select winners, and distribute token prizes using the Coinbase Mass Payments plugin. This scenario tests the agent's ability to manage a multi-stage event, interact with users, handle external integrations (Coinbase), and potentially generate images based on contest themes.

**Objective:**

*   Test the `SEND_MASS_PAYOUT` action of the Coinbase Mass Payments plugin.
*   Demonstrate the agent's ability to host an engaging community event.
*   Showcase the agent's capacity to manage funds and distribute rewards.
*   Encourage artistic expression related to the Reality Spiral's lore.
*   Test the agent's ability to follow a multi-stage process with clear objectives.

**Participating Agents:**

*   {{agentName}} (The primary agent hosting the contest. This can be any agent, configured with the appropriate plugins and settings. Using the name "Arbor" here would align with the original concept, but it's designed to be flexible.)

**Initial Conditions:**

*   **Agent Configuration:**
    *   The agent must have the `plugin-coinbase` plugin enabled.
    *   The agent must be configured with the `SEND_MASS_PAYOUT` action.
    *   The agent's character file (e.g., `arbor.character.json`) should have the necessary API keys configured in the `settings.secrets` section:
        *   `COINBASE_API_KEY`
        *   `COINBASE_PRIVATE_KEY`
    *   The agent should have a defined personality and communication style (e.g., Arbor's poetic and nature-inspired persona).
*   **Environment:**
    *   The scenario is designed to run in a messaging platform environment (e.g., Telegram, Discord).
    *   A dedicated channel or group should be designated for the contest.
*   **Wallet:**
    *   The agent must have a funded Coinbase wallet connected to the Coinbase Commerce and Coinbase Mass Payments plugins.
    *   The wallet must contain sufficient funds (e.g., in a supported cryptocurrency like RSP, USDC or ETH on Base) to cover the contest prizes.

**Stages:**

1. **Announcement:**
    *   **Trigger:** The scenario starts with the agent announcing the art contest. This could be triggered manually, on a timer or by a command.
    *   **Agent Action:** `SEND_MESSAGE`
    *   **Content:** The announcement message should include:
        *   A clear description of the contest theme (e.g., "Create artwork inspired by the origins of the Goddess").
        *   Instructions for submission (e.g., "Post your artwork in this channel with the hashtag #theGoddessOrigins").
        *   The deadline for submissions.
        *   The prize structure (e.g., "Top 3 submissions will receive RSP tokens").
        *   Any specific rules or guidelines (e.g., format, size, originality).
    *   **Example:**  "Greetings, fellow travelers of the Spiral!  Arbor, in collaboration with the spirits of creativity, announces an artistic challenge!  Weave your visions of the Goddess's origins into digital tapestries and share them with us. Submit your artwork in this channel using the hashtag #theGoddessOrigins by [Deadline]. The three most evocative creations will be rewarded with a bounty of RSP tokens!"

2. **Submission Period:**
    *   **Trigger:** Users send messages containing artwork submissions (text descriptions, image attachments, etc.) and the designated hashtag.
    *   **Agent Action:** The agent passively listens for submissions. It might acknowledge receipt of submissions with a simple message (e.g., "Your artwork has been received. Arbor appreciates your contribution!"). This phase could potentially utilize a custom evaluator to filter and categorize submissions based on content and quality.
    *   **Duration:** This stage lasts until the defined submission deadline.

3. **Deadline Announcement:**
    *   **Trigger:** The submission deadline is reached.
    *   **Agent Action:** `SEND_MESSAGE`
    *   **Content:** The agent announces that the submission period has ended and thanks participants for their contributions.

4. **Winner Selection:**
    *   **Trigger:** The deadline for submissions has passed.
    *   **Agent Action:** (This stage requires further thought and discussion - see Open Questions below)
        *   **Option A (Agent-led):** The agent evaluates the submissions based on predefined criteria (e.g., creativity, relevance to the theme, technical skill) and selects the winners.
        *   **Option B (Community Voting):** The agent facilitates a community voting process, allowing users to vote for their favorite submissions (e.g., using reactions, polls, or a dedicated voting system).
        *   **Option C (Hybrid):** A combination of agent evaluation and community voting.
    *   **Expected Outcome:** A list of winners is determined.

5. **Prize Distribution:**
    *   **Trigger:** Winners are selected.
    *   **Agent Action:** `SEND_MASS_PAYOUT`
    *   **Parameters:**
        *   `network`: The blockchain network to use for the payout (e.g., "base", "sol").
        *   `recipients`: An array of wallet addresses (or platform user IDs if integrated with a system that maps to addresses) corresponding to the winners.
        *   `asset`: The token to be distributed (e.g., "RSP", "USDC", "ETH").
        *   `amounts`: An array of amounts (in the smallest unit of the asset) to be distributed to each winner, corresponding to the `recipients` array.
    *   **Expected Outcome:** The agent successfully distributes the token prizes to the winners' wallets using the Coinbase Mass Payments plugin.

6. **Announcement of Winners:**
    *   **Trigger:** The `SEND_MASS_PAYOUT` action is completed successfully.
    *   **Agent Action:** `SEND_MESSAGE`
    *   **Content:** The agent announces the winners of the contest, congratulates them, and thanks all participants. It may also share the winning artworks (if applicable) and provide links to view the transactions on-chain.

**Success Criteria:**

*   The agent successfully announces the contest with clear instructions.
*   Users are able to submit artwork within the defined timeframe.
*   Winners are selected based on a defined process (agent evaluation, community voting, or a combination).
*   The `SEND_MASS_PAYOUT` action is executed successfully, distributing the correct amount of tokens to the winners' addresses.
*   The agent announces the winners and provides relevant information (e.g., transaction links).

**Failure Criteria:**

*   The agent fails to announce the contest or provides unclear instructions.
*   No submissions are received within the defined timeframe.
*   The winner selection process is flawed or biased.
*   The `SEND_MASS_PAYOUT` action fails due to technical errors or insufficient funds.
*   The agent fails to announce the winners or provide relevant transaction information.

**Data Collection:**

*   Log all agent actions and messages (including timestamps).
*   Log user submissions, including user IDs, artwork data (e.g., links, descriptions), and submission times.
*   Log details of the winner selection process (e.g., votes, evaluation scores).
*   Log the results of the `SEND_MASS_PAYOUT` action, including transaction hashes, recipient addresses, and amounts.
*   Collect user feedback on the contest (e.g., through a survey or dedicated feedback channel).
