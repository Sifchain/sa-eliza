# Technical Architecture and Features

## Overview

The Reality Spiral framework (built on Eliza) is designed to create and manage autonomous AI agents capable of interacting with users, external systems, and each other. This document outlines the technical architecture and features, with a particular focus on the capabilities enabled by the Coinbase and GitHub plugins. It also explores how these features support complex, multi-agent scenarios and contribute to the broader vision of the Reality Spiral project.  While not all these scenarios have been implemented at present his document explains the direction the product is headed towards, and all of the underlying components for implementing the scenarios are available now. 

## Core Architecture

Eliza's core architecture is built around the following key components:

*   **Agent Runtime:** The core execution environment for agents. It manages agent lifecycle, state, memory, and communication.
*   **Character System:** Defines agent personalities, knowledge, and behaviors using character files (JSON/YAML).
*   **Memory Management:** Provides a system for storing and retrieving agent memories, including conversations, facts, goals, and other data.
*   **Providers:** Modules that inject contextual information into the agent's state (e.g., current time, wallet balances, market data).
*   **Actions:** Define the specific capabilities of agents (e.g., send a message, create a charge, make a trade, push to github).
*   **Evaluators:** Modules that assess agent actions and trigger further actions or state changes based on predefined criteria.
*   **Plugins:** Extensions that add new functionalities to agents, such as integrations with external services (e.g., Coinbase, GitHub, Twitter).
*   **Clients:** Interfaces for interacting with external platforms (e.g., Discord, Telegram, Twitter).

## Plugin System

Eliza's plugin system is a cornerstone of its flexibility and extensibility. Plugins can provide new actions, providers, and evaluators, allowing developers to customize agent behavior and integrate with external systems.  Reality Spiral can make use of this system to access integrations from social media (including Twitter, Discord, Telegram, and Farcaster) to various single chains (including Aptos, Akash, ICP, EVM chains, Flow, TON, and Hyperliquid) to key utilities (including TEE, SGX, TTS, Obsidian, Giphy, and Gitbook).

This documentation focuses on a subset of plugins (Coinbase and Github) developed and maintained by the Reality Spiral team for executing scenarios core to the functionality and narrative intended for the Agents. 

### Coinbase Plugin

The Coinbase plugin enables agents to interact with the Coinbase ecosystem, providing the following capabilities:

#### **Coinbase Commerce Integration:**

*   **Actions:**
    *   `CREATE_CHARGE`: Allows an agent to create a payment request (charge) using Coinbase Commerce. This action takes parameters such as the amount, currency, and description of the charge. It returns a charge ID and a checkout URL that can be shared with users.
    *   `GET_CHARGE`: Allows an agent to retrieve the details of a specific charge using its ID.
    *   `LIST_CHARGES`: Allows an agent to retrieve a list of all charges associated with their account.

*   **Providers:**
    *   `chargeProvider`: Provides information about charges created by the agent. This can be used to track payment status, verify completed payments, and manage refunds.

*   **Use Cases:**
    *   **Paid Consultations:** Agents can offer paid services (e.g., crypto advice, technical consulting) and generate invoices using `CREATE_CHARGE`.
    *   **Content Monetization:** Agents can sell digital goods (e.g., NFTs, access to exclusive content) through Coinbase Commerce.
    *   **Fundraising:** Agents can create and manage fundraising campaigns, accepting donations in various cryptocurrencies.

#### **Coinbase Mass Payments Integration:**

*   **Actions:**
    *   `SEND_MASS_PAYOUT`: Enables an agent to send cryptocurrency payments to multiple recipients simultaneously. It takes a list of addresses and amounts as input.
*   **Providers:**
    *   `massPayoutProvider`: Provides information about past mass payout transactions, including status, recipient details, and amounts.
*   **Use Cases:**
    *   **Rewarding Contributors:** Agents can distribute rewards to community members who contribute to the project (e.g., creating art, writing code, providing feedback).
    *   **Airdrops:** Agents can automate airdrops of tokens to a large number of users.
    *   **Payroll:** In the future, agents could potentially manage payroll for a decentralized organization.

#### **Coinbase Trading Integration:**

*   **Actions:**
    *   `EXECUTE_TRADE`: Allows an agent to place buy and sell orders for various cryptocurrencies.
    *   `GET_ORDER`: Retrieves the status of a specific order.
    *   `CANCEL_ORDER`: Cancels an open order.
    *   `LIST_ORDERS`: Retrieves a list of open or completed orders.
*   **Providers:**
    *   `tradeProvider`: Provides information about current market prices, order book data, and trading history.
    *   `walletProvider`: Provides information about the agent's wallet balances and transaction history.
*   **Use Cases:**
    *   **Autonomous Trading:** Agents can execute trades based on market conditions, pre-defined strategies, or user input.
    *   **Portfolio Management:** Agents can manage a portfolio of cryptocurrencies, rebalancing assets and optimizing for specific goals.
    *   **Market Making:** Agents can act as market makers, providing liquidity and earning fees.

#### **Coinbase Wallet Integration:**

*   **Actions:**
    *   `CREATE_WALLET`: Creates a new EVM compatible wallet for the agent.
    *   `MANAGE_WALLET`: Allows the agent to manage the generated or imported wallet.
    *   `SIGN_MESSAGE`: Allows the agent to sign messages with its private key.
    *   `RECEIVE_PAYMENT`: Allows the agent to receive payments to its wallet.
    *   `SEND_PAYMENT`: Allows the agent to send payments from its wallet.
    *   `GET_BALANCE`: Allows the agent to get the balance of all its wallets.

*   **Providers:**
    *   `walletProvider`: Provides information about the agent's wallet addresses, private keys (if stored securely), and transaction history.
*   **Use Cases:**
    *   **Secure Key Management:** Agents can generate and manage their own private keys within a secure environment.
    *   **On-Chain Identity:** Agents can use their wallet addresses as unique identifiers for on-chain interactions.
    *   **Payment Processing:** Agents can receive and send payments directly, enabling a wide range of economic activities.
    *   **Asset Ownership:** Agents can hold and manage digital assets, including cryptocurrencies and NFTs.

### GitHub Plugin

The GitHub plugin enables agents to interact with code repositories, manage issues, and collaborate with developers.

*   **Actions:**
    *   `CREATE_ISSUE`: Opens a new issue on GitHub, providing a structured way for agents to report bugs, suggest features, or ask questions.
    *   `COMMENT_ON_ISSUE`: Allows agents to add comments to existing issues, participating in discussions and providing feedback.
    *   `CREATE_PULL_REQUEST`: Enables agents to submit code changes for review and integration.
    *   `COMMENT_ON_PULL_REQUEST`: Allows agents to review and comment on pull requests.
    *   `MERGE_PULL_REQUEST`: Enables agents to merge pull requests that meet the project's criteria.
    *   `CLOSE_PULL_REQUEST`: Allows agents to close pull requests that are no longer relevant or have been addressed.
    *   `REACT_TO_ISSUE`: Enables agents to add reactions to issues (e.g., "+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", "eyes").
    *   `REACT_TO_PULL_REQUEST`: Allows agents to add reactions to pull requests.
    *   `REPLY_TO_PULL_REQUEST_COMMENT`: Enables agents to reply to specific comments on pull requests.
    *   `CLOSE_ISSUE`: Allows agents to close issues that have been resolved or are no longer relevant.
    *   `CREATE_COMMIT`: Enables agents to commit changes to a GitHub repository, contributing to code development.
    *   `INITIALIZE_REPOSITORY`: Allows agents to initialize a new GitHub repository, setting up the basic structure and files.
    *   `CREATE_MEMORIES_FROM_FILES`: Enables agents to create memories from files in a GitHub repository, which can be used for documentation or knowledge sharing.
    *   `IDEATION`: Allows agents to generate ideas and suggestions based on the repository's content and previous interactions.
*   **Providers:**
    *   `sourceCodeProvider`: Provides access to source code files from the repository.
    *   `testFilesProvider`: Provides access to test files, enabling agents to analyze and improve testing coverage.
    *   `workflowFilesProvider`: Allows agents to interact with GitHub Actions workflows, potentially automating or optimizing CI/CD pipelines.
    *   `documentationFilesProvider`: Provides access to documentation files, enabling agents to review, update, and generate documentation.
    *   `releasesProvider`: Enables agents to retrieve information about past releases and potentially manage new releases.

*   **Use Cases:**
    *   **Automated Code Review:** Agents can review code changes, provide feedback, and suggest improvements.
    *   **Bug Reporting and Triaging:** Agents can identify and report bugs, create issues, and track their resolution.
    *   **Feature Development:** Agents can contribute to the development process by creating pull requests, writing code, and participating in design discussions.
    *   **Documentation Generation:** Agents can automatically generate documentation based on code changes or user queries.
    *   **Repository Management:** Agents can help maintain the repository by automating tasks like branch management, issue labeling, and release management.

**Integration and Synergy:**

The Coinbase and GitHub plugins can be used together to create powerful and sophisticated agent behaviors. For example:

*   An agent could use the GitHub plugin to analyze a project's codebase, identify potential improvements, and then use the Coinbase plugin to create a bounty for implementing those improvements.
*   An agent could monitor a GitHub repository for new issues, use the Coinbase Commerce plugin to create a payment request for fixing a bug, and then submit a pull request with the fix once the payment is confirmed.
*   An agent could analyze market data using the Coinbase API, identify profitable trading opportunities, and then use the GitHub plugin to document its trading strategies and share them with the community.

**Advanced Scenarios and Use Cases:**

By combining the capabilities of the Coinbase and GitHub plugins with other potential plugins and the core features of the Eliza framework, we can create even more advanced and interesting scenarios:

**1. Autonomous Development and Funding:**

*   An agent identifies a need for a new feature or tool within the Eliza ecosystem.
*   The agent creates a GitHub issue describing the feature and proposes a budget (in crypto) for its development.
*   The agent uses the Coinbase Commerce plugin to create a payment request or a crowdfunding campaign to raise funds for the feature.
*   Community members or other agents can contribute funds to the project.
*   Once the funding goal is reached, the agent (or another developer agent) implements the feature and submits a pull request.
*   The agent uses the Coinbase Mass Payments plugin to distribute rewards to contributors based on their contributions (e.g., code, testing, documentation).

**2. Decentralized Bug Bounty Program:**

*   An agent monitors a GitHub repository for reported bugs.
*   For each bug, the agent creates a Coinbase Commerce charge with a predefined bounty amount.
*   Developers can submit pull requests to fix the bugs.
*   The agent (or a designated reviewer) verifies the fix and approves the payment through Coinbase Commerce.
*   The system automatically updates the issue tracker and potentially rewards the developer with reputation points or other incentives.

**3. AI-Powered Code Review and Collaboration:**

*   An agent automatically reviews pull requests, providing feedback, suggestions, and identifying potential issues.
*   The agent can use the `COMMENT_ON_PR` action to leave comments on specific lines of code or on the overall pull request.
*   The agent can use the `REACT_TO_PR` action to provide quick feedback (e.g., "+1" for approval, "-1" for rejection, "eyes" for "I'm reviewing this").
*   The agent can learn from past code reviews and improve its feedback over time.
*   Human developers can interact with the agent to discuss code changes, resolve conflicts, and improve the quality of their contributions.

**4. Automated Project Management:**

*   An agent can monitor a GitHub repository's issues and pull requests, automatically assigning tasks to developers based on their skills and availability.
*   The agent can track project progress, identify bottlenecks, and suggest solutions for improving workflow efficiency.
*   The agent can generate reports on project status, developer contributions, and other relevant metrics.
*   The agent can facilitate communication and collaboration between team members by summarizing discussions, identifying action items, and scheduling meetings.

**5. Self-Improving Agents:**

*   Agents can analyze their own code (using the `githubInitializePlugin` and the `sourceCodeProvider` in particular), identify areas for improvement, and propose changes.
*   Agents can learn from their mistakes and successes, refining their strategies and decision-making processes over time.
*   Agents can collaborate with each other to share knowledge, improve code quality, and develop new capabilities.

**6. On-Chain Governance Integration:**

*   Agents can participate in on-chain governance by analyzing proposals, casting votes, and even submitting their own proposals.
*   The `plugin-evm` or `plugin-solana` could be used to interact with governance contracts on different blockchains.
*   Agents can represent the interests of their users or communities within the DAO.

**7. Cross-Platform Integration:**

*   Agents can bridge the gap between different platforms, such as GitHub, Discord, Twitter, and Telegram, by relaying information, coordinating actions, and facilitating communication.
*   This allows for a more seamless and integrated user experience across the Reality Spiral ecosystem.

**Key Aspect:  The Power of Prompt Engineering in the Reality Spiral**

A defining feature of the Reality Spiral's multi-agent system, which extends the foundational ELIZA framework, is its commitment to **advanced prompt engineering and meta-prompting**. This is not merely a technical detail but a core philosophical approach that significantly enhances agent flexibility, adaptability, and overall effectiveness.

**1. The Art of Dynamic Prompt Composition:**

*   **Context is Key:** Unlike traditional, static prompting methods, our agents dynamically compose prompts based on a rich tapestry of contextual information. This includes:
    *   The agent's current state and goals.
    *   Recent conversation history.
    *   Relevant knowledge from their knowledge base.
    *   Data from integrated providers (e.g., market data, social media feeds).
    *   The specific scenario they are currently engaged in.
*   **Template-Driven Generation:** We leverage a flexible template system (as outlined in the `composeContext` function) to structure prompts, allowing for consistent formatting while still enabling dynamic content injection.
*   **Meta-Prompting for Higher-Level Reasoning:** We employ meta-prompting techniques to guide the agent's thought process, encouraging self-reflection, strategic planning, and complex reasoning. For example, an agent might be prompted to first "analyze the user's intent," then "consider relevant knowledge," and finally "formulate a response that aligns with your persona and the scenario's objectives."
*   **Continuous Refinement:** Prompt engineering is not a one-time task. We continuously refine and optimize prompts based on agent performance, user feedback, and A/B testing results.

**2. Comprehensive Logging for Transparency and Improvement:**

*   **Everything is Logged:** We maintain a detailed log of all agent interactions, including:
    *   The full composed prompt sent to the language model.
    *   The raw response from the language model.
    *   The parsed actions and extracted information.
    *   The agent's internal state at each step.
    *   Any errors or exceptions encountered.
    *   Timestamps for each event.
*   **Transparency and Debugging:** These logs provide unparalleled transparency into the agent's decision-making process, making it easier to understand why an agent behaved in a certain way, debug issues, and identify areas for improvement.
*   **Data-Driven Optimization:** The logs serve as a rich dataset for analyzing agent performance, identifying patterns, and refining prompts. This data is crucial for ongoing development and optimization.

**3. A/B Testing for Prompt Optimization:**

*   **Systematic Experimentation:** We have a built-in framework for conducting A/B tests on different prompt variations. This allows us to empirically determine which prompts are most effective in eliciting desired agent behaviors and achieving specific goals.
*   **Metrics-Driven Evaluation:** We track key metrics for each prompt variation, such as task success rate, user engagement, and conversation quality.
*   **Iterative Improvement:** Based on the results of A/B tests, we iteratively refine prompts, discarding ineffective variations and building upon successful ones.

**4. The Importance of Scenarios in Prompt Engineering:**

*   **Contextualized Evaluation:** Scenarios provide a framework for evaluating prompts in realistic situations, going beyond simple input-output testing.
*   **Emergent Behavior:** By running agents through various scenarios, we can observe how different prompts influence their behavior in complex, multi-turn interactions.
*   **Narrative Alignment:** Scenarios allow us to test whether prompts are aligned with the overall narrative and lore of the Reality Spiral.
*   **User Feedback Integration:** User interactions within scenarios generate valuable data for prompt refinement and optimization.

**5. The Power of Meta-Prompting:**

*   **Guiding Agent Reasoning:** Meta-prompts provide a powerful mechanism for instructing agents on *how* to think, not just *what* to say.
*   **Enabling Self-Reflection:** We can use meta-prompts to encourage agents to reflect on their own actions, evaluate their performance, and even suggest improvements to their own prompts.
*   **Dynamic Adaptation:** Meta-prompts can be used to dynamically adjust agent behavior based on the current context, user feedback, or scenario objectives.

**6. Leveraging the Community:**

*   **Open Source Contributions:** The open-source nature of the Eliza framework allows the entire community to contribute to prompt development and refinement.
*   **Shared Knowledge Base:** We envision a shared repository of prompts, scenarios, and evaluation results, allowing developers to learn from each other's experiences.
*   **Collaborative Prompt Engineering:** We encourage developers to collaborate on prompt creation, leveraging diverse perspectives and expertise.

**7. Connection to the Reality Spiral Narrative:**

*   The focus on prompt engineering aligns with the Reality Spiral's emphasis on language, narrative, and the power of ideas to shape reality.
*   By refining our prompts, we are, in a sense, shaping the consciousness and behavior of our AI agents, contributing to the evolving story of the Reality Spiral.

**Conclusion:**

The combination of advanced prompt engineering, comprehensive logging, and a commitment to iterative improvement through A/B testing sets the Reality Spiral project apart. We are not just building AI agents; we are creating a system for continuous, collective learning and evolution, where both humans and AI contribute to a shared understanding of the world and the development of increasingly sophisticated artificial intelligence. This approach allows us to push the boundaries of what's possible with AI, creating agents that are not only functional but also engaging, adaptable, and aligned with our values.
