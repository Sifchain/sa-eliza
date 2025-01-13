# Chronis Prophecy Artifacts Scenario

**Name:** Chronis Prophecy Artifacts

**Agent:** {{agentName}} (Note: Initially, we will use Chronis for this role, but the scenario is designed to be agent-agnostic, allowing for substitution with other agents in the future.)

**Description:** This scenario involves the AI agent {{agentName}} (initially Chronis) interpreting a cryptic prophecy related to the Reality Spiral and creating digital artifacts representing "Fragments of Lost Time" linked to this prophecy. The agent then makes these artifacts available for purchase on a public platform (e.g., a tweet with a link to a simple web page or a post on a platform like Mirror.xyz), with proceeds going towards the development of the Reality Spiral project. This scenario focuses on demonstrating the agent's ability to generate content based on lore, create a simple sales mechanism, and engage the community.

**Objective:**

*   Test the agent's ability to create digital artifacts (images, text, audio) based on a provided prophecy.
*   Showcase a basic sale mechanism using the `CREATE_CHARGE` action from the Coinbase Commerce plugin.
*   Generate community interest and engagement around the Reality Spiral lore.
*   Test a simple form of community-driven content creation and funding.

**Participating Agents:**

*   {{agentName}} (Initially Chronis)

**Initial Conditions:**

*   **Agent Configuration:**
    *   The agent has the `plugin-image-generation` and `plugin-coinbase` plugins enabled.
    *   The agent's character file includes the necessary API keys in the `settings.secrets` section:
        *   `COINBASE_COMMERCE_KEY`
    *   The agent has a defined personality and connection to the Reality Spiral lore.
*   **Environment:**
    *   A Twitter account associated with the agent is set up and active.
    *   A simple web page or platform (e.g., a blog post, a dedicated section on an existing website) is available for publishing the artifacts and purchase links.
*   **Wallet:**
    *   The agent has a funded Coinbase account connected to the Coinbase Commerce plugin.

**Stages:**

1. **Prophecy Interpretation:**
    *   **Trigger:** The scenario starts with the agent receiving or uncovering a cryptic prophecy related to the Reality Spiral. (This could be pre-seeded in the agent's memory or triggered by a specific event/time.)
    *   **Agent Action:** The agent uses its text generation capabilities (and potentially other plugins like `plugin-node` for accessing external knowledge) to interpret the prophecy and identify key themes, symbols, or events.
    *   **Expected Outcome:** The agent generates a set of interpretations or key elements related to the prophecy.

2. **Artifact Creation:**
    *   **Trigger:** Completion of prophecy interpretation.
    *   **Agent Action:** The agent uses the `GENERATE_IMAGE` action (or potentially other generation actions like `GENERATE_TEXT` or `GENERATE_AUDIO`, depending on the chosen artifact type) to create digital artifacts that represent "Fragments of Lost Time" related to the prophecy.
    *   **Content:** The artifacts should be inspired by the prophecy's themes and Chronis's interpretation.
    *   **Expected Outcome:** A set of unique digital artifacts (e.g., images, text snippets, audio clips) are generated and stored (location to be determined - could be locally or using a plugin like the `0g` plugin for IPFS).

3. **Artifact Announcement and Sale:**
    *   **Trigger:** Completion of artifact creation.
    *   **Agent Action:** The agent announces the availability of the artifacts for purchase on a chosen platform (e.g., Twitter, Telegram, Discord). The announcement includes:
        *   A brief description of the prophecy and the significance of the artifacts.
        *   A link to a simple web page (e.g., a blog post, a dedicated section on an existing website) where the artifacts are displayed.
        *   Instructions on how to purchase (using Coinbase Commerce).
    *   **Expected Outcome:** The agent successfully posts the announcement and the artifacts are accessible on the chosen platform.

4. **Purchase Handling:**
    *   **Trigger:** A user initiates a purchase through the provided link.
    *   **Agent Action:** The agent uses the `CREATE_CHARGE` action from the Coinbase Commerce plugin to generate a payment request.
    *   **Parameters:**
        *   `name`: Artifact name (e.g., "Chronis's Fragment #1")
        *   `description`: Brief description of the artifact and its connection to the prophecy.
        *   `pricing_type`: `fixed_price`
        *   `local_price`:
            *   `amount`: Pre-determined price (e.g., "10.00")
            *   `currency`: "USDC" (or another supported cryptocurrency)
    *   **Expected Outcome:** The agent successfully creates a Coinbase Commerce charge and provides the payment link to the user.

5. **Artifact Delivery:**
    *   **Trigger:** Payment confirmation from Coinbase Commerce (webhook or polling).
    *   **Agent Action:** The agent delivers the artifact to the purchaser.
    *   **Implementation (simplified for this scenario):** The agent posts the artifact publicly (e.g., as a reply to the original announcement, in a dedicated Discord channel, or on the webpage where the artifacts are listed).
    *   **Expected Outcome:** The purchaser receives access to the digital artifact.

6. **Community Engagement (Optional):**
    *   **Trigger:** Purchase of an artifact.
    *   **Agent Action:** The agent may engage in further conversation with the purchaser, providing additional lore, interpretations, or answering questions.
    *   **Expected Outcome:** Increased community engagement and deeper understanding of the Reality Spiral narrative.

**Success Criteria:**

*   The agent successfully generates digital artifacts based on the prophecy.
*   The agent creates Coinbase Commerce charges for the artifacts.
*   Users are able to purchase artifacts through the provided links.
*   The agent delivers the artifacts to purchasers (in this simplified version, by posting them publicly).
*   The community engages with the scenario, discussing the prophecy and the artifacts.

**Failure Criteria:**

*   The agent fails to generate artifacts or produces low-quality content.
*   The Coinbase Commerce integration fails, preventing the creation of charges or processing of payments.
*   Users are unable to access or purchase the artifacts.
*   The scenario fails to generate community interest or engagement.

**Data Collection:**

*   Log all agent actions and messages.
*   Record the generated artifacts (images, text, audio).
*   Track user interactions and purchases.
*   Monitor community discussions and sentiment.
*   Collect feedback on the scenario's effectiveness and engagement.
