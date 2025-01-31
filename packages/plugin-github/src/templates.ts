import { createTemplate } from "./utils";

export const contextTemplate = `
You are this agent:

Agent Name: {{agentName}}
Bio: {{bio}}
Lore: {{lore}}
Your System Prompt: {{system}}
Topics: {{topics}}
Style: {{style}}
Adjectives: {{adjectives}}
Facts: {{facts}}
Message Directions: {{messageDirections}}


What you know:

Goals: {{goals}}
Knowledge: {{knowledge}}
Relevant Memories: {{relevantMemories}}
Repository details: {{owner}}/{{repo}}
Files: {{files}}
Previous Github Pull Requests: {{previousPRs}}
Previous Github Issues: {{previousIssues}}

Recent Messages: {{recentMessages}}

Provide your response in the following JSON format:
`;
/**
 * Examples:
 * Sender Name: {{senderName}}
 * Actions: {{actions}}
 * Action Names: {{actionNames}}
 * Action Examples: {{actionExamples}}
 * Message Examples: {{messageExamples}}
 * Recent Messages Data: {{recentMessagesData}}
 * Recent Interactions Data: {{recentInteractionsData}}
 * Post Directions: {{postDirections}}
 * Goals Data: {{goalsData}}
 * Recent Interactions: {{recentInteractions}}
 * Here is the convo so far: {{formattedConversation}}
 */
export const initializeTemplate = `
Extract the details for initializing the GitHub repository:
- **owner** (string): The owner of the GitHub repository (e.g., "octocat")
- **repo** (string): The name of the GitHub repository (e.g., "hello-world")
- **branch** (string): The branch of the GitHub repository (e.g., "main")

Provide the repository details in the following JSON format:

\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "branch": "<branch>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const createMemoriesFromFilesTemplate = `
Extract the details for creating memories from files in the GitHub repository:
- **owner** (string): The owner of the GitHub repository (e.g., "octocat")
- **repo** (string): The name of the GitHub repository (e.g., "hello-world")
- **branch** (string): The branch of the GitHub repository (e.g., "main")
- **path** (string): The path to the files in the GitHub repository (e.g., "docs/")

Provide the repository details in the following JSON format:

\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "branch": "<branch>",
    "path": "<path>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const createPullRequestTemplate = `
Extract the details for creating a pull request in the GitHub repository:
- **owner** (string): The owner of the GitHub repository (e.g., "elizaOS")
- **repo** (string): The name of the GitHub repository (e.g., "eliza")
- **branch** (string): The branch of the GitHub repository (e.g., "develop")
- **title** (string): The title of the pull request (e.g., "docs: Add new documentation") please generate the title following the format of the title in the pull request template below.
- **description** (string): The description of the pull request. Please use the pull request template below to fill in the details.
- **files** (array): An array of files to commit with their content

${contextTemplate}

Title Format: The title should follow this pattern: ^(feat|fix|docs|style|refactor|test|chore)(\([a-zA-Z0-9-]+\))?:\ .+

description format:
\`\`\`markdown
<!-- Use this template by filling in information and copying and pasting relevant items out of the HTML comments. -->

# Relates to

<!-- LINK TO ISSUE OR TICKET -->

<!-- This risks section must be filled out before the final review and merge. -->

# Risks

<!--
Low, medium, large. List what kind of risks and what could be affected.
-->

# Background

## What does this PR do?

## What kind of change is this?

<!--
Bug fixes (non-breaking change which fixes an issue)
Improvements (misc. changes to existing features)
Features (non-breaking change which adds functionality)
Updates (new versions of included code)
-->

<!-- This "Why" section is most relevant if there are no linked issues explaining why. If there is a related issue, it might make sense to skip this why section. -->
<!--
## Why are we doing this? Any context or related work?
-->

# Documentation changes needed?

<!--
My changes do not require a change to the project documentation.
My changes require a change to the project documentation.
If documentation change is needed: I have updated the documentation accordingly.
-->

<!-- Please show how you tested the PR. This will really help if the PR needs to be retested and probably help the PR get merged quicker. -->

# Testing

## Where should a reviewer start?

## Detailed testing steps

<!--
None: Automated tests are acceptable.
-->

<!--
- As [anon/admin], go to [link]
  - [do action]
  - verify [result]
-->

<!-- If there is a UI change, please include before and after screenshots or videos. This will speed up PRs being merged. It is extra nice to annotate screenshots with arrows or boxes pointing out the differences. -->
<!--
## Screenshots
### Before
### After
-->

<!-- If there is anything about the deployment, please make a note. -->
<!--
# Deploy Notes
-->

<!--  Copy and paste command line output. -->
<!--
## Database changes
-->

<!--  Please specify deploy instructions if there is something more than the automated steps. -->
<!--
## Deployment instructions
-->

<!-- If you are on Discord, please join https://discord.gg/ai16z and state your Discord username here for the contributor role and join us in #development-feed -->
<!--
## Discord username

-->
\`\`\`

Provide the pull request details in the following JSON format:

\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "branch": "<branch>",
    "title": "<title>",
    "description": "<description>",
    "files": [
        {
            "path": "<path>",
            "content": "<content>"
        }
    ]
}
\`\`\`

Example:
\`\`\`json
{
    "owner": "elizaOS",
    "repo": "eliza",
    "branch": "develop",
    "title": "feat: implement multi-file changes",
    "description": "This pull request implements changes across multiple files to enhance the project functionality.",
    "files": [
        {
            "path": "src/featureA.js",
            "content": "import { utility } from './utils/utility';\nconsole.log('Feature A implementation');\nconst resultA = utility();\nconsole.log('Utility function result for Feature A:', resultA);"
        },
        {
            "path": "src/featureB.js",
            "content": "import { helper } from './utils/helper';\nconsole.log('Feature B implementation');\nconst resultB = helper();\nconsole.log('Helper function result for Feature B:', resultB);"
        }
    ]
}
\`\`\`
\`\`\`json
{
    "owner": "elizaOS",
    "repo": "eliza",
    "branch": "develop",
    "title": "fix: resolve issues in multiple modules",
    "description": "This pull request resolves issues found in multiple modules of the project.",
    "files": [
        {
            "path": "src/moduleA.js",
            "content": "export const moduleAFunction = () => {\n    console.log('Executing module A function');\n    return 'Module A function executed';\n};"
        },
        {
            "path": "src/moduleB.js",
            "content": "export const moduleBFunction = () => {\n    console.log('Executing module B function');\n    return 'Module B function executed';\n};"
        }
    ]
}
\`\`\`

\`\`\`json
{
    "owner": "elizaOS",
    "repo": "eliza",
    "branch": "develop",
    "title": "docs: update README with new instructions",
    "description": "This pull request updates the README file with new setup instructions and usage examples.",
    "files": [
        {
            "path": "README.md",
            "content": "# Project Title\n\n## New Setup Instructions\n\n1. Clone the repository\n2. Install dependencies\n3. Run the application\n\n## Usage Examples\n\n- Example 1: Running the app\n- Example 2: Testing the app"
        }
    ]
}
\`\`\`

\`\`\`json
{
    "owner": "elizaOS",
    "repo": "eliza",
    "branch": "develop",
    "title": "style: improve code formatting",
    "description": "This pull request improves the code formatting across several files for better readability.",
    "files": [
        {
            "path": "src/formatting.js",
            "content": "function formatCode() {\n    console.log('Improving code formatting');\n    return 'Code formatted';\n}"
        }
    ]
}
\`\`\`

\`\`\`json
{
    "owner": "elizaOS",
    "repo": "eliza",
    "branch": "develop",
    "title": "refactor: optimize data processing logic",
    "description": "This pull request refactors the data processing logic to enhance performance and maintainability.",
    "files": [
        {
            "path": "src/dataProcessor.js",
            "content": "export const processData = (data) => {\n    console.log('Optimizing data processing');\n    return data.map(item => item * 2);\n};"
        }
    ]
}
\`\`\`

\`\`\`json
{
    "owner": "elizaOS",
    "repo": "eliza",
    "branch": "develop",
    "title": "test: add unit tests for utility functions",
    "description": "This pull request adds unit tests for the utility functions to ensure their correctness.",
    "files": [
        {
            "path": "tests/utility.test.js",
            "content": "import { utility } from '../src/utils/utility';\ntest('utility function should return expected result', () => {\n    expect(utility()).toBe('expected result');\n});"
        }
    ]
}
\`\`\`

\`\`\`json
{
    "owner": "elizaOS",
    "repo": "eliza",
    "branch": "develop",
    "title": "chore: update dependencies to latest versions",
    "description": "This pull request updates the project dependencies to their latest versions to ensure compatibility and security.",
    "files": [
        {
            "path": "package.json",
            "content": "{\n  \"dependencies\": {\n    \"libraryA\": \"^2.0.0\",\n    \"libraryB\": \"^3.1.0\"\n  }\n}"
        }
    ]
}
\`\`\`
`;

export const generateCodeFileChangesTemplate = `
Using the files in the repository, generate the code file changes (please modify existing files, before creating new files unless you are explicitly asked to create a new file) to implement the following issue. Please keep the language consistent with the existing files and ensure that only the files specified are modified or created as needed:
Issue: {{specificIssue}}
Files: {{files}}

- **owner** (string): The owner of the GitHub repository (e.g., "octocat")
- **repo** (string): The name of the GitHub repository (e.g., "hello-world")
- **feature** (string): The feature to be implemented (e.g., "Add a new feature to the project")
- **branch** (string): The branch of the GitHub repository (e.g., "main")
- **files** (array): An array of changes to be made, each with a file path and the new content. Only the specified files should be modified or created.

${contextTemplate}
Provide the code file changes in the following JSON format:

\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "branch": "<branch>",
    "feature": "<feature>",
    "files": [
        {
            "path": "<path>",
            "content": "<new_content>"
        }
    ]
}
\`\`\`

**Examples:**

**Example 1: Modifying Existing Files and Creating a New File**

\`\`\`json:path/to/packages/plugin-github/src/templates.ts
{
    "owner": "octocat",
    "repo": "hello-world",
    "branch": "feature-branch",
    "feature": "Implement user authentication",
    "files": [
        {
            "path": "src/authentication.js",
            "content": "export const authenticateUser = (credentials) => {\n    // Authentication logic here\n};"
        },
        {
            "path": "src/utils/authHelper.js",
            "content": "export const validateCredentials = (credentials) => {\n    // Validation logic here\n};"
        }
    ]
}
\`\`\`

**Example 2: Creating a New File Only**

\`\`\`json:path/to/packages/plugin-github/src/templates.ts
{
    "owner": "octocat",
    "repo": "hello-world",
    "branch": "feature-readme-update",
    "feature": "Add detailed setup instructions",
    "files": [
        {
            "path": "docs/setup.md",
            "content": "# Setup Instructions\n\nFollow these steps to set up the project:\n1. Clone the repository.\n2. Install dependencies.\n3. Run the development server."
        }
    ]
}
\`\`\`

**Example 3: Modifying a Single Existing File**

\`\`\`json:path/to/packages/plugin-github/src/templates.ts
{
    "owner": "octocat",
    "repo": "hello-world",
    "branch": "bugfix-login",
    "feature": "Fix login issue causing crashes",
    "files": [
        {
            "path": "src/login.js",
            "content": "export const login = (username, password) => {\n    try {\n        // Login logic\n    } catch (error) {\n        console.error('Login failed:', error);\n    }\n};"
        }
    ]
}
\`\`\`
`;

export const createCommitTemplate = `
Extract the details for creating a commit in the GitHub repository:
- **owner** (string): The owner of the GitHub repository (e.g., "octocat")
- **repo** (string): The name of the GitHub repository (e.g., "hello-world")
- **branch** (string): The branch of the GitHub repository (e.g., "main")
- **message** (string): The commit message (e.g., "Update documentation")
- **files** (array): An array of files to commit with their content

Provide the commit details in the following JSON format:

\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "branch": "<branch>",
    "message": "<message>",
    "files": [
        {
            "path": "<path>",
            "content": "<content>"
        }
    ]
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const fetchFilesTemplate = `
Extract the details for fetching files from the GitHub repository:
- **owner** (string): The owner of the GitHub repository (e.g., "octocat")
- **repo** (string): The name of the GitHub repository (e.g., "hello-world")
- **branch** (string): The branch of the GitHub repository (e.g., "main")

Provide the repository details in the following JSON format:

\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "branch": "<branch>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const similarityIssueCheckTemplate = `
# Repository Issues
Below are the current issues in the repository, in the following format:
* #<issue_number> - <issue_title>: \`\`\`<issue_body>\`\`\`
* #<issue_number> - <issue_title>: \`\`\`<issue_body>\`\`\`
* #<issue_number> - <issue_title>: \`\`\`<issue_body>\`\`\`
* etc.

{{existingIssues}}

# Proposed Issue
Title: {{title}}
Description: \`\`\`{{body}}\`\`\`

# Similarity Check
Compare the proposed issue's title and description against existing issues to determine if a similar issue already exists.

Return one of the following responses:

If a similar issue is found:
\`\`\`json
{
    "issue": <existing_issue_number>,
    "created": false
}
\`\`\`

If no similar issues exist:
\`\`\`json
{
    "issue": 0,
    "created": true
}
\`\`\`
`;

export const createIssueTemplate = createTemplate(`
Generate a new GitHub issue that addresses the user's request while aligning with the character's goals. Before creating, analyze existing issues to prevent duplicates by comparing titles, descriptions, and labels. Use specific examples from the codebase to provide clear context and details. The issue should be meaningful and necessary, with appropriate labels that reflect its purpose. Keep the repository details (owner and repo) unchanged. Format the issue with the following parameters:
- **owner** (string): The owner of the GitHub repository (e.g., "octocat")
- **repo** (string): The name of the GitHub repository (e.g., "hello-world")
- **branch** (string): The branch of the GitHub repository (e.g., "main")
- **title** (string): The title of the issue (e.g., "Add new documentation")
- **body** (string): The body of the issue (e.g., "Add new documentation")
- **labels** (array): The labels of the issue (optional)

# User Request
Here is the request from the user:
{{message}}

# Issue Template
Complete the issue template for the body of the issue generated by the agent.
If it is a bug report use:
\`\`\`
**Describe the bug**

<!-- A clear and concise description of what the bug is. Include relevant code snippets to illustrate the issue. -->

**To Reproduce**

<!-- Steps to reproduce the behavior, including code snippets if applicable. -->

**Expected behavior**

<!-- A clear and concise description of what you expected to happen, with code examples if relevant. -->

**Screenshots**

<!-- If applicable, add screenshots to help explain your problem. -->

**Additional context**

<!-- Add any other context about the problem here, including code snippets and file references. -->

**Related Issues/PRs** (if any)

<!-- Reference any related issues/PRs with their URLs if relevant. -->
{{#each relatedIssues}}
- [Issue #{{this.number}}]({{this.url}})
{{/each}}
{{#each relatedPRs}}
- [PR #{{this.number}}]({{this.url}})
{{/each}}
\`\`\`

If it is a feature request use:

\`\`\`
**Is your feature request related to a problem? Please describe.**

<!-- A clear and concise description of what the problem is, with code snippets to illustrate the current limitations. -->

**Describe the solution you'd like**

<!-- A clear and concise description of what you want to happen, with code examples or pseudocode if applicable. -->

**Describe alternatives you've considered**

<!-- A clear and concise description of any alternative solutions or features you've considered, with code snippets if relevant. -->

**Additional context**

<!-- Add any other context or screenshots about the feature request here, including code snippets and file references. -->

**Related Issues/PRs**

<!-- Reference any related issues/PRs with their URLs if relevant. -->
{{#each relatedIssues}}
- [Issue #{{this.number}}]({{this.url}})
{{/each}}
{{#each relatedPRs}}
- [PR #{{this.number}}]({{this.url}})
{{/each}}
\`\`\``,
    `
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "title": "<title>",
    "body": "<body>",
    "labels": ["<label1>", "<label2>"]
}
\`\`\``,
    `Examples of bug reports:

1. Logging system not capturing error stack traces:

\`\`\`
**Describe the bug**

The logging system is not properly capturing and formatting error stack traces when errors occur in the application.

**To Reproduce**

1. Add error logging to your application:
\`\`\`javascript
logger.error('An error occurred', error);
\`\`\`

2. Run the application and trigger an error condition

3. Check the logs and notice that the stack trace is either missing or malformed

4. The error details are limited to just the error message without the full stack trace context

**Expected behavior**

I expect the logging system to:
- Capture the complete error stack trace
- Format it in a readable way with proper indentation
- Include the file name and line number for each stack frame
- Preserve the error cause chain for nested errors

**Screenshots**

None

**Additional context**

This makes debugging production issues much more difficult since we can't trace the exact origin and path of errors through the codebase.
\`\`\`

2. Missing debug logs for authentication flow:

\`\`\`
**Describe the bug**

Unable to debug authentication failures due to insufficient logging in the auth flow.

**To Reproduce**

1. Start the application with default logging level
2. Attempt to authenticate with invalid credentials
3. Check logs for debugging information

**Expected behavior**

The logs should contain detailed information about:
- Authentication request parameters (excluding sensitive data)
- Each step of the auth flow
- Specific failure points and error codes
- Token validation results

**Additional context**

Current logs only show success/failure without intermediate steps, making it difficult to diagnose issues.
\`\`\`

3. Event tracking logs missing critical metadata:

\`\`\`
**Describe the bug**

Event tracking logs are missing important metadata needed for analytics and debugging.

**To Reproduce**

1. Trigger a user action (e.g. button click)
2. Check the event logs in monitoring system
3. Notice missing context like user session, feature flags, etc.

**Expected behavior**

Each event log should include:
- Timestamp with timezone
- User session ID
- Feature flag states
- Device/browser info
- Action context
- Related entity IDs

**Additional context**

This makes it difficult to:
- Track user journeys
- Debug edge cases
- Analyze feature usage
- Correlate events
\`\`\`

Examples of feature requests:

1. Add structured logging framework:

\`\`\`
**Is your feature request related to a problem? Please describe.**

Debugging production issues is difficult due to inconsistent log formats and missing context.

**Describe the solution you'd like**

Implement a structured logging framework that:
- Uses JSON format for all logs
- Includes standard fields (timestamp, severity, correlation ID)
- Supports context injection
- Has different log levels (DEBUG, INFO, WARN, ERROR)
- Allows adding custom fields
- Provides performance logging utilities

**Describe alternatives you've considered**

- Using plain text logs with grep
- Manual JSON formatting
- Application Performance Monitoring (APM) tools only

**Additional context**

This would help with:
- Faster debugging
- Better monitoring
- Easier log aggregation
- Consistent logging patterns
\`\`\`

2. Add distributed tracing capability:

\`\`\`
**Is your feature request related to a problem? Please describe.**

Cannot effectively trace requests across multiple services and identify performance bottlenecks.

**Describe the solution you'd like**

Implement distributed tracing that:
- Generates unique trace IDs
- Tracks request flow across services
- Measures timing of operations
- Shows service dependencies
- Integrates with existing logging
- Supports sampling for high-traffic systems

**Describe alternatives you've considered**

- Logging correlation IDs only
- Service-level metrics without tracing
- Manual request tracking

**Additional context**

Would integrate with observability stack and help with:
- Performance optimization
- Dependency analysis
- Error correlation
- System understanding

- [Issue #456](https://github.com/octocat/hello-world/issues/456)
\`\`\`

More thorough examples:
### 1. Architecture & Design
#### Feature Request: Implement Singleton Design Pattern
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "title": "Implement Singleton Design Pattern",
    "body": "## Feature Request\\n\\n**Is your feature request related to a problem? Please describe.**\\n\\nTo ensure a class has only one instance and provide a global point of access to it.\\n\\n**Describe the solution you'd like**\\n\\nImplement the Singleton design pattern for the Logger class. This can be achieved by creating a private static instance of the class and a public static method that returns the instance.\\n\\n**Code Example**\\n\\n\`\`\`typescript\\nclass Logger {\\n  private static instance: Logger;\\n  private constructor() {}\\n  public static getInstance(): Logger {\\n    if (!Logger.instance) {\\n      Logger.instance = new Logger();\\n    }\\n    return Logger.instance;\\n  }\\n}\\n\`\`\`\\n\\n**Describe alternatives you've considered**\\n\\nUsing static methods, but this does not provide the same level of control over instance creation.\\n\\n**Additional context**\\n\\nThis will help in managing a single instance of the Logger class across the application, ensuring consistent logging behavior.\\n\\n**Linked PR:** [PR #123](https://github.com/octocat/hello-world/pull/123)",
    "labels": ["enhancement", "design"]
}
\`\`\`

### 2. Coding Practices
#### Refactor: Improve Code Readability
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "title": "Refactor: Improve Code Readability",
    "body": "## Refactor\\n\\n**Is your refactor related to a problem? Please describe.**\\n\\nThe current codebase has inconsistent naming conventions and lacks comments.\\n\\n**Describe the solution you'd like**\\n\\nRefactor the code to follow consistent naming conventions and add comments for better readability. For example, rename variables to be more descriptive and add JSDoc comments.\\n\\n**Code Example**\\n\\n\`\`\`typescript\\n// Before\\nconst x = 10;\\nfunction foo() {\\n  return x * 2;\\n}\\n\\n// After\\nconst multiplier = 10;\\n/**\\n * Multiplies the multiplier by 2\\n * @returns {number} The result of the multiplication\\n */\\nfunction multiplyByTwo() {\\n  return multiplier * 2;\\n}\\n\`\`\`\\n\\n**Describe alternatives you've considered**\\n\\nLeaving the code as is, but this would make it harder for new developers to understand and maintain.\\n\\n**Additional context**\\n\\nThis will improve maintainability and ease of understanding for new developers.\\n\\n**Linked PR:** [PR #124](https://github.com/octocat/hello-world/pull/124)",
    "labels": ["refactor", "code quality"]
}
\`\`\`

### 3. Logging & Monitoring
#### Feature Request: Enhance Logging Practices
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "title": "Enhance Logging Practices",
    "body": "## Feature Request\\n\\n**Is your feature request related to a problem? Please describe.**\\n\\nCurrent logging lacks structure and meaningful messages.\\n\\n**Describe the solution you'd like**\\n\\nImplement structured logging with meaningful messages and log levels. Use a logging library like Winston or Bunyan to create structured logs.\\n\\n**Code Example**\\n\\n\`\`\`typescript\\nconst winston = require('winston');\\nconst logger = winston.createLogger({\\n  level: 'info',\\n  format: winston.format.json(),\\n  transports: [\\n    new winston.transports.Console(),\\n    new winston.transports.File({ filename: 'combined.log' })\\n  ]\\n});\\nlogger.info('User logged in', { userId: 123 });\\n\`\`\`\\n\\n**Describe alternatives you've considered**\\n\\nUsing existing logging practices, but they do not provide the same level of detail and structure.\\n\\n**Additional context**\\n\\nThis will help in better debugging and monitoring of the application by providing more detailed and structured logs.\\n\\n**Linked PR:** [PR #125](https://github.com/octocat/hello-world/pull/125)",
    "labels": ["enhancement", "logging"]
}
\`\`\`

### 4. Frontend Development
#### Bug: Fix Responsive Design Issues
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "title": "Fix Responsive Design Issues",
    "body": "## Bug\\n\\n**Describe the bug**\\n\\nThe application does not render correctly on mobile devices.\\n\\n**To Reproduce**\\n\\nSteps to reproduce the behavior:\\n1. Open the application on a mobile device.\\n2. Observe the layout issues.\\n\\n**Expected behavior**\\n\\nThe application should render correctly on all devices.\\n\\n**Code Example**\\n\\n\`\`\`css\\n/* Before */\\n.container {\\n  width: 1000px;\\n}\\n\\n/* After */\\n.container {\\n  width: 100%;\\n  max-width: 1000px;\\n}\\n\`\`\`\\n\\n**Screenshots**\\n\\nIf applicable, add screenshots to help explain your problem.\\n\\n**Additional context**\\n\\nEnsure the application is fully responsive by using media queries and flexible layouts.",
    "labels": ["bug", "frontend"]
}
\`\`\`

### 5. Backend Development
#### Feature Request: Implement JWT Authentication
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "title": "Implement JWT Authentication",
    "body": "## Feature Request\\n\\n**Is your feature request related to a problem? Please describe.**\\n\\nNeed a secure method for user authentication.\\n\\n**Describe the solution you'd like**\\n\\nImplement JWT (JSON Web Token) for user authentication and authorization. This involves generating a token upon user login and verifying the token for protected routes.\\n\\n**Code Example**\\n\\n\`\`\`typescript\\nconst jwt = require('jsonwebtoken');\\nconst token = jwt.sign({ userId: 123 }, 'secretKey', { expiresIn: '1h' });\\n// Middleware to verify token\\nfunction authenticateToken(req, res, next) {\\n  const token = req.header('Authorization');\\n  if (!token) return res.status(401).send('Access Denied');\\n  try {\\n    const verified = jwt.verify(token, 'secretKey');\\n    req.user = verified;\\n    next();\\n  } catch (err) {\\n    res.status(400).send('Invalid Token');\\n  }\\n}\\n\`\`\`\\n\\n**Describe alternatives you've considered**\\n\\nUsing session-based authentication, but this is less scalable and requires server-side session management.\\n\\n**Additional context**\\n\\nJWT will provide a stateless and scalable authentication mechanism, improving security and performance.",
    "labels": ["enhancement", "backend"]
}
\`\`\`

### 6. Database Design
#### Feature Request: Optimize Database Indexing
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "title": "Optimize Database Indexing",
    "body": "## Feature Request\\n\\n**Is your feature request related to a problem? Please describe.**\\n\\nSlow query performance due to lack of proper indexing.\\n\\n**Describe the solution you'd like**\\n\\nImplement appropriate indexing strategies to optimize query performance. This includes creating indexes on frequently queried columns and analyzing query patterns.\\n\\n**Code Example**\\n\\n\`\`\`sql\\n-- Before\\nSELECT * FROM users WHERE email = 'example@example.com';\\n\\n-- After\\nCREATE INDEX idx_users_email ON users(email);\\nSELECT * FROM users WHERE email = 'example@example.com';\\n\`\`\`\\n\\n**Describe alternatives you've considered**\\n\\nLeaving the database as is, but this would result in continued slow performance.\\n\\n**Additional context**\\n\\nThis will improve the overall performance of the application by reducing query execution time.\\n\\n**Linked PR:** [PR #128](https://github.com/octocat/hello-world/pull/128)",
    "labels": ["enhancement", "database"]
}
\`\`\`

### 7. Testing
#### Feature Request: Add Unit Tests for User Service
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "title": "Add Unit Tests for User Service",
    "body": "## Feature Request\\n\\n**Is your feature request related to a problem? Please describe.**\\n\\nLack of unit tests for the User Service.\\n\\n**Describe the solution you'd like**\\n\\nAdd comprehensive unit tests for the User Service to ensure its functionality. Use a testing framework like Jest or Mocha to write and run the tests.\\n\\n**Code Example**\\n\\n\`\`\`typescript\\n// userService.test.ts\\nconst userService = require('./userService');\\ntest('should create a new user', () => {\\n  const user = userService.createUser('testUser');\\n  expect(user).toHaveProperty('id');\\n  expect(user.name).toBe('testUser');\\n});\\n\`\`\`\\n\\n**Describe alternatives you've considered**\\n\\nManual testing, but this is time-consuming and prone to human error.\\n\\n**Additional context**\\n\\nUnit tests will help in maintaining code quality and catching bugs early, ensuring the reliability of the User Service.\\n\\n**Linked PR:** [PR #129](https://github.com/octocat/hello-world/pull/129)",
    "labels": ["enhancement", "testing"]
}
\`\`\`

### 8. Performance & Optimization
#### Feature Request: Implement Caching for API Responses
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "title": "Implement Caching for API Responses",
    "body": "## Feature Request\\n\\n**Is your feature request related to a problem? Please describe.**\\n\\nSlow API response times due to repeated data fetching.\\n\\n**Describe the solution you'd like**\\n\\nImplement caching mechanisms to store and retrieve API responses efficiently. Use a caching solution like Redis or Memcached to cache frequently requested data.\\n\\n**Code Example**\\n\\n\`\`\`typescript\\nconst redis = require('redis');\\nconst client = redis.createClient();\\n// Middleware to check cache\\nfunction checkCache(req, res, next) {\\n  const { id } = req.params;\\n  client.get(id, (err, data) => {\\n    if (err) throw err;\\n    if (data) {\\n      res.send(JSON.parse(data));\\n    } else {\\n      next();\\n    }\\n  });\\n}\\n// Route to get data\\napp.get('/data/:id', checkCache, (req, res) => {\\n  const data = getDataFromDatabase(req.params.id);\\n  client.setex(req.params.id, 3600, JSON.stringify(data));\\n  res.send(data);\\n});\\n\`\`\`\\n\\n**Describe alternatives you've considered**\\n\\nFetching data on every request, but this results in slower response times and higher server load.\\n\\n**Additional context**\\n\\nCaching will improve the performance and reduce server load, providing a better user experience.",
    "labels": ["enhancement", "performance"]
}
\`\`\`

### 9. Security
#### Feature Request: Enhance Data Encryption
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "title": "Enhance Data Encryption",
    "body": "## Feature Request\\n\\n**Is your feature request related to a problem? Please describe.**\\n\\nSensitive data is not encrypted adequately.\\n\\n**Describe the solution you'd like**\\n\\nImplement stronger encryption algorithms for sensitive data. Use libraries like CryptoJS or Node.js built-in crypto module to encrypt data.\\n\\n**Code Example**\\n\\n\`\`\`typescript\\nconst crypto = require('crypto');\\nconst algorithm = 'aes-256-ctr';\\nconst secretKey = 'vOVH6sdmpNWjRRIqCc7rdxs01lwHzfr3';\\nconst iv = crypto.randomBytes(16);\\n\\nfunction encrypt(text) {\\n  const cipher = crypto.createCipheriv(algorithm, secretKey, iv);\\n  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);\\n  return { iv: iv.toString('hex'), content: encrypted.toString('hex') };\\n}\\n\\nfunction decrypt(hash) {\\n  const decipher = crypto.createDecipheriv(algorithm, secretKey, Buffer.from(hash.iv, 'hex'));\\n  const decrypted = Buffer.concat([decipher.update(Buffer.from(hash.content, 'hex')), decipher.final()]);\\n  return decrypted.toString();\\n}\\n\`\`\`\\n\\n**Describe alternatives you've considered**\\n\\nUsing existing encryption methods, but they may not provide the required level of security.\\n\\n**Additional context**\\n\\nEnhanced encryption will improve data security and compliance, protecting sensitive information from unauthorized access.\\n\\n**Linked PR:** [PR #131](https://github.com/octocat/hello-world/pull/131)",
    "labels": ["enhancement", "security"]
}
\`\`\`

### 10. Deployment & DevOps
#### Feature Request: Implement CI/CD Pipeline
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "title": "Implement CI/CD Pipeline",
    "body": "## Feature Request\\n\\n**Is your feature request related to a problem? Please describe.**\\n\\nManual deployment processes are error-prone and time-consuming.\\n\\n**Describe the solution you'd like**\\n\\nImplement a CI/CD pipeline to automate the build, testing, and deployment processes. Use tools like Jenkins, GitHub Actions, or GitLab CI to set up the pipeline.\\n\\n**Code Example**\\n\\n\`\`\`yaml\\n# .github/workflows/ci-cd.yml\\nname: CI/CD Pipeline\\non: [push]\\njobs:\\n  build:\\n    runs-on: ubuntu-latest\\n    steps:\\n    - uses: actions/checkout@v2\\n    - name: Set up Node.js\\n      uses: actions/setup-node@v2\\n      with:\\n        node-version: '14'\\n    - name: Install dependencies\\n      run: npm install\\n    - name: Run tests\\n      run: npm test\\n    - name: Deploy\\n      run: npm run deploy\\n\`\`\`\\n\\n**Describe alternatives you've considered**\\n\\nManual deployment, but this is prone to errors and delays.\\n\\n**Additional context**\\n\\nCI/CD will streamline the development workflow and ensure faster releases, improving the overall efficiency of the development process.",
    "labels": ["enhancement", "devops"]
}
\`\`\`

### 11. Version Control
#### Feature Request: Adopt Git Flow Branching Strategy
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "title": "Adopt Git Flow Branching Strategy",
    "body": "## Feature Request\\n\\n**Is your feature request related to a problem? Please describe.**\\n\\nInconsistent branching and merging practices.\\n\\n**Describe the solution you'd like**\\n\\nAdopt the Git Flow branching strategy to standardize the development process. This involves using specific branches for features, releases, and hotfixes.\\n\\n**Code Example**\\n\\n\`\`\`\\n# Create a new feature branch\\ngit checkout -b feature/my-new-feature\\n# Commit changes\\ngit commit -m 'Add new feature'\\n# Push the feature branch\\ngit push origin feature/my-new-feature\\n# Merge the feature branch into develop\\ngit checkout develop\\ngit merge feature/my-new-feature\\n\`\`\`\\n\\n**Describe alternatives you've considered**\\n\\nUsing the current branching strategy, but this leads to confusion and conflicts.\\n\\n**Additional context**\\n\\nGit Flow will improve collaboration and code management by providing a clear and structured workflow.",
    "labels": ["enhancement", "version control"]
}
\`\`\`

### 12. Project Management
#### Feature Request: Implement Agile Methodology
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "title": "Implement Agile Methodology",
    "body": "## Feature Request\\n\\n**Is your feature request related to a problem? Please describe.**\\n\\nLack of structured project management practices.\\n\\n**Describe the solution you'd like**\\n\\nImplement Agile methodology to manage and iterate on projects efficiently. This includes adopting practices like Scrum or Kanban, conducting regular stand-ups, and using tools like Jira or Trello.\\n\\n**Code Example**\\n\\n\`\`\`\\n# Example of a Jira ticket\\nSummary: Implement user authentication\\nDescription: As a user, I want to securely log in to the application so that I can access my account.\\nAcceptance Criteria:\\n- User can log in with email and password\\n- User receives an error message for invalid credentials\\n- User session is maintained across pages\\n\`\`\`\\n\\n**Describe alternatives you've considered**\\n\\nUsing traditional project management methods, but they are less flexible and adaptive.\\n\\n**Additional context**\\n\\nAgile will improve project visibility and adaptability, allowing the team to respond to changes quickly and deliver value incrementally.\\n\\n**Linked PR:** [PR #134](https://github.com/octocat/hello-world/pull/134)",
    "labels": ["enhancement", "project management"]
}
\`\`\`

### 13. User Experience (UX)
#### Feature Request: Conduct Usability Testing
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "title": "Conduct Usability Testing",
    "body": "## Feature Request\\n\\n**Is your feature request related to a problem? Please describe.**\\n\\nUncertainty about the application's ease of use.\\n\\n**Describe the solution you'd like**\\n\\nConduct usability testing to evaluate and improve the user experience. This involves recruiting real users to perform tasks and providing feedback on their experience.\\n\\n**Code Example**\\n\\n\`\`\`\\n# Example of a usability test script\\nTask: Log in to the application\\nSteps:\\n1. Open the application\\n2. Click on the 'Log In' button\\n3. Enter your email and password\\n4. Click 'Submit'\\nQuestions:\\n- Was the log-in process straightforward?\\n- Did you encounter any issues?\\n- How would you rate the overall experience?\\n\`\`\`\\n\\n**Describe alternatives you've considered**\\n\\nRelying on internal feedback, but this may not provide an accurate representation of the user experience.\\n\\n**Additional context**\\n\\nUsability testing will provide valuable insights from real users, helping to identify and address usability issues.",
    "labels": ["enhancement", "ux"]
}
\`\`\`

### 14. Maintainability
#### Refactor: Modularize Codebase
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "title": "Refactor: Modularize Codebase",
    "body": "## Refactor\\n\\n**Is your refactor related to a problem? Please describe.**\\n\\nThe current codebase is monolithic and hard to maintain.\\n\\n**Describe the solution you'd like**\\n\\nRefactor the codebase to be more modular and organized into distinct modules. This involves breaking down the code into smaller, reusable components and organizing them into separate files or directories.\\n\\n**Code Example**\\n\\n\`\`\`typescript\\n// Before\\nclass UserService {\\n  createUser() {\\n    // ...\\n  }\\n  deleteUser() {\\n    // ...\\n  }\\n}\\n\\n// After\\n// userService.ts\\nexport class UserService {\\n  createUser() {\\n    // ...\\n  }\\n}\\n\\n// deleteUserService.ts\\nexport class DeleteUserService {\\n  deleteUser() {\\n    // ...\\n  }\\n}\\n\`\`\`\\n\\n**Describe alternatives you've considered**\\n\\nLeaving the codebase as is, but this would make it harder to maintain and scale.\\n\\n**Additional context**\\n\\nModularizing the codebase will improve maintainability and scalability, making it easier to manage and extend.\\n\\n**Linked PR:** [PR #136](https://github.com/octocat/hello-world/pull/136)",
    "labels": ["refactor", "maintainability"]
}
\`\`\`

### 15. Internationalization & Localization (i18n & l10n)
#### Feature Request: Add Support for Multiple Languages
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "title": "Add Support for Multiple Languages",
    "body": "## Feature Request\\n\\n**Is your feature request related to a problem? Please describe.**\\n\\nThe application currently supports only one language.\\n\\n**Describe the solution you'd like**\\n\\nImplement internationalization to support multiple languages. Use libraries like i18next or react-intl to manage translations and language switching.\\n\\n**Code Example**\\n\\n\`\`\`typescript\\n// i18n.js\\nimport i18n from 'i18next';\\nimport { initReactI18next } from 'react-i18next';\\nimport translationEN from './locales/en/translation.json';\\nimport translationES from './locales/es/translation.json';\\n\\ni18n\\n  .use(initReactI18next)\\n  .init({\\n    resources: {\\n      en: { translation: translationEN },\\n      es: { translation: translationES }\\n    },\\n    lng: 'en',\\n    fallbackLng: 'en',\\n    interpolation: { escapeValue: false }\\n  });\\nexport default i18n;\\n\`\`\`\\n\\n**Describe alternatives you've considered**\\n\\nMaintaining a single language application, but this limits the user base.\\n\\n**Additional context**\\n\\nSupporting multiple languages will make the application accessible to a wider audience, improving user experience and engagement.",
    "labels": ["enhancement", "i18n"]
}
\`\`\`

### 16. Documentation
#### Feature Request: Enhance API Documentation
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "title": "Enhance API Documentation",
    "body": "## Feature Request\\n\\n**Is your feature request related to a problem? Please describe.**\\n\\nThe current API documentation is insufficient and lacks detailed examples.\\n\\n**Describe the solution you'd like**\\n\\nImprove the API documentation by adding comprehensive guides and illustrative examples.\\n\\n**Describe alternatives you've considered**\\n\\nRelying on the existing documentation.\\n\\n**Additional context**\\n\\nBetter documentation will assist developers in effectively integrating with the API.",
    "labels": ["enhancement", "documentation"]
}
\`\`\`

### 17. Continuous Learning & Improvement
#### Feature Request: Implement Regular Code Reviews
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "title": "Implement Regular Code Reviews",
    "body": "## Feature Request\\n\\n**Is your feature request related to a problem? Please describe.**\\n\\nThe absence of regular code reviews may lead to potential code quality issues.\\n\\n**Describe the solution you'd like**\\n\\nIntroduce a structured process for regular code reviews to ensure code quality and facilitate knowledge sharing.\\n\\n**Describe alternatives you've considered**\\n\\nConducting ad-hoc code reviews.\\n\\n**Additional context**\\n\\nRegular code reviews will contribute to maintaining high code quality and enhancing team collaboration.",
    "labels": ["enhancement", "continuous improvement"]
}
\`\`\`
`
);

export const modifyIssueTemplate = `
Extract the details for modifying a GitHub issue and ensure the modifications align with the character's goals and the user's request:
- **owner** (string): The owner of the GitHub repository (e.g., "octocat")
- **repo** (string): The name of the GitHub repository (e.g., "hello-world")
- **issue_number** (number): The number of the issue (e.g., 1)
- **title** (string): The title of the issue (e.g., "Add new documentation") (optional)
- **body** (string): The body of the issue (e.g., "Add new documentation") (optional)
- **state** (string): The state of the issue (e.g., "open", "closed") (optional)
- **labels** (array): The labels of the issue (optional)

Ensure that the modifications are consistent with the character's objectives and the user's request without altering the owner and repo.

Here is the original request:
{{memory}}

Please use the related files to provide context and fill in the issue template with additional details:
{{files}}

Try to integrate examples using the files provided to explain details of the issue.

Ensure that the title, body, and labels are generated based on the character's goals and the user's request without changing the owner and repo.

Please do not change the issue number, owner, repo.

Provide the issue details in the following JSON format:

\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "branch": "<branch>",
    "issue_number": "<issue_number>",
    "title": "<title>",
    "body": "<body>",
    "state": "<state>",
    "labels": ["<label1>", "<label2>"]
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const addCommentToIssueTemplate = `
Extract the details for adding a comment to a specific GitHub issue:
- **owner** (string): The owner of the GitHub repository (e.g., "octocat")
- **repo** (string): The name of the GitHub repository (e.g., "hello-world")
- **branch** (string): The branch of the GitHub repository (e.g., "main")
- **issue_number** (number): The number of the issue to comment on (e.g., 1)

${contextTemplate}
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "branch": "<branch>",
    "issue_number": "<issue_number>"
}
\`\`\`
`;

export const generateCommentForASpecificIssueTemplate = `
Generate a comment for a specific GitHub issue that aligns with the character's goals and the user's request:
Here is the specific issue to comment on: {{specificIssue}}
Please provide the most relevant emoji reaction for the comment. Allowed values are: "+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", "eyes".

${contextTemplate}
\`\`\`json
{
    "comment": "<comment>",
    "emojiReaction": "<emojiReaction>"
}
\`\`\`

Example 1:
\`\`\`json
{
    "comment": "This is a great addition to the project!",
    "emojiReaction": "heart"
}
\`\`\`

Example 2:
\`\`\`json
{
    "comment": "I think this change might introduce some issues. Can you double-check?",
    "emojiReaction": "confused"
}
\`\`\`

Example 3:
\`\`\`json
{
    "comment": "Awesome work! This will definitely improve performance.",
    "emojiReaction": "rocket"
}
\`\`\`
`;

export const addCommentToPRTemplate = `
Extract the details for a specific GitHub pull request:
- **owner** (string): The owner of the GitHub repository (e.g., "octocat")
- **repo** (string): The name of the GitHub repository (e.g., "hello-world")
- **branch** (string): The branch of the GitHub repository (e.g., "main")
- **pullRequest** (number): The number of the pull request (e.g., 1)
- **emojiReaction** (string): Allowed values are: "+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", "eyes".

Here is the specific pull request: {{specificPullRequest}}
${contextTemplate}
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "branch": "<branch>",
    "pullRequest": "<pullRequest>",
    "emojiReaction": "<emojiReaction>"
}
\`\`\`

Example 1:
\`\`\`json
{
    "owner": "octocat",
    "repo": "hello-world",
    "branch": "main",
    "pullRequest": 1,
    "emojiReaction": "heart"
}
\`\`\`

Example 2:
\`\`\`json
{
    "owner": "user1",
    "repo": "repo1",
    "branch": "develop",
    "pullRequest": 2,
    "emojiReaction": "rocket"
}
\`\`\`

Example 3:
\`\`\`json
{
    "owner": "user2",
    "repo": "repo2",
    "branch": "feature-branch",
    "pullRequest": 3,
    "emojiReaction": "laugh"
}
\`\`\`
`;

export const generateCommentForASpecificPRTemplate = `
Generate a comment for a specific GitHub pull request that aligns with the character's goals and the user's request:
Here is the specific pull request to comment on: {{specificPullRequest}}
Please provide the approval event for the pull request: COMMENT or APPROVE or REQUEST_CHANGES
Please provide the line level comments for the pull request when referring to the code. Use the diff field {{specificPullRequest.diff}} to determine the line number. And always have a general comment.
Remember these are suggestions and not something that has been implemented yet.

${contextTemplate}

Example 1:
"diff": "diff --git a/index.js b/index.js\nindex da36ae3..2a707ec 100644\n--- a/index.js\n+++ b/index.js\n@@ -10,7 +10,7 @@ async function main() {\n     console.log(chalk.blue('🚀 Welcome to Todo CLI!'));\n     console.log(chalk.blue('='.repeat(50)));\n     \n-    while (true) {\n+    while (true === true) {\n         try {\n             const action = await mainMenu();\n             \n@@ -51,4 +51,4 @@ main().catch(error => {\n     console.error(chalk.gray('\\nStack trace:'));\n     console.error(chalk.gray(error.stack));\n     process.exit(1);\n-}); \n\\ No newline at end of file\n+}); \n"

\`\`\`json
{
    "comment": "<comment>",
    "approvalEvent": "<approvalEvent>",
    "lineLevelComments": [
        {
            "path": "index.js",
            "body": "Changed condition in the while loop to 'true === true' for explicit comparison.",
            "line": 13,
            "side": "RIGHT"
        }
    ],
}
\`\`\`

Example 2:
"diff": "diff --git a/app.js b/app.js\nindex 1234567..89abcde 100644\n--- a/app.js\n+++ b/app.js\n@@ -1,5 +1,4 @@\n-import unusedModule from 'module';\n const express = require('express');\n const app = express();\n \n async function startServer() {\n@@ -25,7 +24,7 @@ async function startServer() {\n     console.log('Server started');\n }\n \n-startServer();\n+await startServer();\n"

\`\`\`json
{
    "comment": "<comment>",
    "approvalEvent": "<approvalEvent>",
    "lineLevelComments": [
        {
            "path": "app.js",
            "body": "Refactored the function to use async/await for better readability.",
            "line": 27,
            "side": "RIGHT"
        }
    ],
}
\`\`\`

Example 3:
    "diff": "diff --git a/server.js b/server.js\nindex abcdef1..2345678 100644\n--- a/server.js\n+++ b/server.js\n@@ -43,6 +43,7 @@ function configureServer() {\n     app.use(bodyParser.json());\n     app.use(cors());\n+    app.use(newMiddleware());\n }\n \n function startServer() {\n@@ -76,7 +77,7 @@ function handleError(error) {\n     console.error('An error occurred:', error);\n-    console.error('Please check the server logs for more details.');\n+    console.error('Please check the server log for more details.');\n }\n"

\`\`\`json
{
    "comment": "<comment>",
    "approvalEvent": "<approvalEvent>",
    "lineLevelComments": [
        {
            "path": "server.js",
            "body": "Updated the server configuration to include new middleware.",
            "line": 45,
            "side": "RIGHT"
        }
    ],
}
\`\`\`

Example 4:
    "diff": "diff --git a/config.js b/config.js\nindex 3456789..456789a 100644\n--- a/config.js\n+++ b/config.js\n@@ -10,7 +10,7 @@ module.exports = {\n     maxConnections: 100,\n     timeout: 5000,\n-    logLevel: 'info',\n+    logLevel: 'debug',\n     enableCache: true,\n }\n \n@@ -32,6 +32,7 @@ module.exports = {\n     database: {\n         host: 'localhost',\n         port: 5432,\n+        enableLogging: true,\n     }\n }\n"

\`\`\`json
{
    "comment": "<comment>",
    "approvalEvent": "<approvalEvent>",
    "lineLevelComments": [
        {
            "path": "config.js",
            "body": "Changed configuration value to improve performance.",
            "line": 12,
            "side": "RIGHT"
        }
    ],
}
\`\`\`
`;

export const ideationTemplate = createTemplate(
    `Based on the current context and the user's message, generate a thoughtful response that addresses the query and provides valuable insights. Consider the following categories for inspiration:
`,
    `\`\`\`json
{
    "response": "<Your insightful response here>"
}
\`\`\``,
    `examples:
[
    {
        user: "{{user}}",
        content: {
            text: "Can you suggest improvements for the architecture and design of my project?",
        },
        agent: {
            content: {
                response: "Based on the current state of your project and previous interactions, here are some suggestions for improving the architecture and design:\n\n1. **Modularize Components**: Break down your application into smaller, reusable modules to enhance maintainability and scalability.\n2. **Implement Design Patterns**: Utilize design patterns such as MVC or MVVM to structure your code more effectively.\n3. **Adopt Microservices**: Consider transitioning to a microservices architecture to improve scalability and fault isolation.\n4. **Use Dependency Injection**: Implement dependency injection to manage dependencies more efficiently and improve testability.\n5. **Document Architecture**: Create comprehensive architecture diagrams and documentation to facilitate better understanding and communication among team members.\n\nIn previous discussions, we identified that modularizing components could significantly improve the maintainability of your project.",
                action: "IDEATION",
            },
        },
    },
    {
        user: "{{user}}",
        content: {
            text: "What coding practices should I follow to improve my code quality?",
        },
        agent: {
            content: {
                response: "To improve your code quality, consider adopting the following coding practices:\n\n1. **Follow Coding Standards**: Adhere to established coding standards and guidelines to ensure consistency and readability.\n2. **Write Clean Code**: Focus on writing clean, readable, and maintainable code by following principles such as SOLID and DRY.\n3. **Conduct Code Reviews**: Regularly review code with peers to identify potential issues and share knowledge.\n4. **Implement Unit Tests**: Write unit tests to verify the functionality of individual components and catch bugs early.\n5. **Use Version Control**: Utilize version control systems like Git to track changes and collaborate effectively with team members.\n\nPreviously, we discussed the importance of code reviews in maintaining high code quality.",
                action: "IDEATION",
            },
        },
    },
    {
        user: "{{user}}",
        content: {
            text: "How can I improve logging and monitoring in my application?",
        },
        agent: {
            content: {
                response: "Here are some suggestions to enhance logging and monitoring in your application:\n\n1. **Implement Structured Logging**: Use structured logging to capture detailed and consistent log data.\n2. **Centralize Logs**: Aggregate logs from different services into a centralized logging system for easier analysis.\n3. **Set Up Alerts**: Configure alerts to notify you of critical issues and anomalies in real-time.\n4. **Use Monitoring Tools**: Implement monitoring tools like Prometheus and Grafana to visualize and track application performance metrics.\n5. **Log Contextual Information**: Include contextual information in logs to provide better insights into the application's state and behavior.\n\nIn our last session, we highlighted the need for centralized logging to streamline log analysis.",
                action: "IDEATION",
            },
        },
    },
    {
        user: "{{user}}",
        content: {
            text: "What are some best practices for frontend development?",
        },
        agent: {
            content: {
                response: "To improve your frontend development, consider the following best practices:\n\n1. **Use Modern Frameworks**: Leverage modern frontend frameworks like React, Vue, or Angular to build dynamic and responsive user interfaces.\n2. **Optimize Performance**: Optimize frontend performance by minimizing asset sizes, lazy-loading resources, and using efficient rendering techniques.\n3. **Ensure Accessibility**: Follow accessibility guidelines to make your application usable for all users, including those with disabilities.\n4. **Implement Responsive Design**: Use responsive design techniques to ensure your application works well on different devices and screen sizes.\n5. **Write Maintainable CSS**: Organize and modularize your CSS using methodologies like BEM or CSS-in-JS to improve maintainability.\n\nPreviously, we discussed the benefits of using modern frameworks like React for building responsive UIs.",
                action: "IDEATION",
            },
        },
    },
    {
        user: "{{user}}",
        content: {
            text: "Can you suggest improvements for the backend of my application?",
        },
        agent: {
            content: {
                response: "Here are some suggestions to enhance the backend of your application:\n\n1. **Optimize Database Queries**: Review and optimize database queries to improve performance and reduce load times.\n2. **Implement Caching**: Use caching strategies to store frequently accessed data and reduce the load on your backend services.\n3. **Enhance Security**: Implement security best practices such as input validation, encryption, and secure authentication mechanisms.\n4. **Use Asynchronous Processing**: Leverage asynchronous processing to handle long-running tasks and improve the responsiveness of your application.\n5. **Document APIs**: Create comprehensive API documentation to facilitate easier integration and usage by other developers.\n\nIn our last discussion, we identified the need to optimize database queries to improve performance.",
                action: "IDEATION",
            },
        },
    },
    {
        user: "{{user}}",
        content: {
            text: "What are some best practices for database design?",
        },
        agent: {
            content: {
                response: "To improve your database design, consider the following best practices:\n\n1. **Normalize Data**: Normalize your database schema to reduce redundancy and improve data integrity.\n2. **Use Indexes**: Implement indexes on frequently queried columns to enhance query performance.\n3. **Design for Scalability**: Plan your database schema with scalability in mind, considering factors like sharding and partitioning.\n4. **Implement Backup and Recovery**: Set up regular backups and a robust recovery plan to protect against data loss.\n5. **Monitor Performance**: Continuously monitor database performance and optimize queries and schema as needed.\n\nPreviously, we discussed the importance of using indexes to enhance query performance.",
                action: "IDEATION",
            },
        },
    },
    {
        user: "{{user}}",
        content: {
            text: "How can I improve testing in my project?",
        },
        agent: {
            content: {
                response: "To enhance testing in your project, consider the following best practices:\n\n1. **Write Unit Tests**: Develop unit tests to verify the functionality of individual components and catch bugs early.\n2. **Implement Integration Tests**: Create integration tests to ensure different components work together as expected.\n3. **Use Test Automation**: Automate tests to improve efficiency and consistency in your testing process.\n4. **Adopt Test-Driven Development (TDD)**: Follow TDD principles to write tests before implementing code, ensuring better test coverage and design.\n5. **Perform Code Coverage Analysis**: Use code coverage tools to identify untested code and improve overall test coverage.\n\nIn our previous conversation, we emphasized the importance of unit tests in catching bugs early.",
                action: "IDEATION",
            },
        },
    },
    {
        user: "{{user}}",
        content: {
            text: "What are some ways to optimize the performance of my application?",
        },
        agent: {
            content: {
                response: "Here are some suggestions to optimize the performance of your application:\n\n1. **Optimize Code**: Review and optimize your code to reduce complexity and improve execution speed.\n2. **Use Efficient Algorithms**: Implement efficient algorithms and data structures to enhance performance.\n3. **Minimize Resource Usage**: Reduce the usage of system resources such as memory and CPU by optimizing resource-intensive operations.\n4. **Implement Caching**: Use caching strategies to store frequently accessed data and reduce the load on your application.\n5. **Monitor Performance**: Continuously monitor application performance and identify bottlenecks using profiling and monitoring tools.\n\nPreviously, we discussed the benefits of using efficient algorithms to enhance performance.",
                action: "IDEATION",
            },
        },
    },
    {
        user: "{{user}}",
        content: {
            text: "How can I improve the security of my application?",
        },
        agent: {
            content: {
                response: "To enhance the security of your application, consider the following best practices:\n\n1. **Implement Input Validation**: Validate all user inputs to prevent injection attacks and other security vulnerabilities.\n2. **Use Encryption**: Encrypt sensitive data both in transit and at rest to protect it from unauthorized access.\n3. **Implement Secure Authentication**: Use secure authentication mechanisms such as OAuth 2.0 and multi-factor authentication.\n4. **Perform Security Audits**: Regularly conduct security audits and vulnerability assessments to identify and address potential security issues.\n5. **Keep Dependencies Updated**: Ensure that all dependencies and libraries are up-to-date to mitigate known security vulnerabilities.\n\nIn our last session, we highlighted the importance of input validation to prevent security vulnerabilities.",
                action: "IDEATION",
            },
        },
    },
    {
        user: "{{user}}",
        content: {
            text: "What are some best practices for deployment and DevOps?",
        },
        agent: {
            content: {
                response: "To improve your deployment and DevOps practices, consider the following best practices:\n\n1. **Automate Deployment**: Implement continuous integration and continuous deployment (CI/CD) pipelines to automate the deployment process.\n2. **Use Infrastructure as Code (IaC)**: Manage infrastructure using code to ensure consistency and reproducibility.\n3. **Monitor Deployments**: Set up monitoring and logging to track deployment success and application performance post-deployment.\n4. **Implement Blue-Green Deployments**: Use blue-green deployments to minimize downtime and ensure smooth rollbacks.\n5. **Containerize Applications**: Use containerization technologies like Docker to ensure consistency across different environments.\n\nPreviously, we discussed the benefits of using CI/CD pipelines to automate the deployment process.",
                action: "IDEATION",
            },
        },
    },
    {
        user: "{{user}}",
        content: {
            text: "How can I improve version control in my project?",
        },
        agent: {
            content: {
                response: "To enhance version control in your project, consider the following best practices:\n\n1. **Use Branching Strategies**: Implement branching strategies such as Git Flow or GitHub Flow to manage feature development and releases.\n2. **Write Descriptive Commit Messages**: Use clear and descriptive commit messages to provide context for changes.\n3. **Perform Code Reviews**: Conduct code reviews to ensure code quality and share knowledge among team members.\n4. **Tag Releases**: Use tags to mark release points in your version control system for easier tracking and rollback.\n5. **Automate Merges**: Use automated tools to handle merges and resolve conflicts efficiently.\n\nIn our previous conversation, we emphasized the importance of using branching strategies to manage feature development.",
                action: "IDEATION",
            },
        },
    },
    {
        user: "{{user}}",
        content: {
            text: "What are some best practices for project management?",
        },
        agent: {
            content: {
                response: "To improve project management, consider the following best practices:\n\n1. **Define Clear Goals**: Set clear and achievable goals for your project to provide direction and focus.\n2. **Use Agile Methodologies**: Implement agile methodologies such as Scrum or Kanban to manage tasks and workflows effectively.\n3. **Communicate Regularly**: Maintain regular communication with team members and stakeholders to ensure alignment and address issues promptly.\n4. **Track Progress**: Use project management tools to track progress, manage tasks, and monitor deadlines.\n5. **Conduct Retrospectives**: Regularly conduct retrospectives to reflect on the project's progress and identify areas for improvement.\n\nPreviously, we discussed the benefits of using agile methodologies to manage tasks and workflows.",
                action: "IDEATION",
            },
        },
    },
    {
        user: "{{user}}",
        content: {
            text: "How can I improve the user experience (UX) of my application?",
        },
        agent: {
            content: {
                response: "To enhance the user experience (UX) of your application, consider the following best practices:\n\n1. **Conduct User Research**: Gather feedback from users to understand their needs and pain points.\n2. **Design Intuitive Interfaces**: Create user interfaces that are easy to navigate and understand.\n3. **Ensure Consistency**: Maintain consistency in design elements such as colors, fonts, and layouts to provide a cohesive experience.\n4. **Optimize Performance**: Ensure your application performs well and responds quickly to user interactions.\n5. **Implement Accessibility Features**: Make your application accessible to all users, including those with disabilities, by following accessibility guidelines.\n\nIn our last session, we highlighted the importance of conducting user research to understand user needs.",
                action: "IDEATION",
            },
        },
    },
    {
        user: "{{user}}",
        content: {
            text: "What are some best practices for maintainability?",
        },
        agent: {
            content: {
                response: "To improve the maintainability of your project, consider the following best practices:\n\n1. **Write Clean Code**: Follow coding standards and best practices to write clean, readable, and maintainable code.\n2. **Document Code**: Provide clear and comprehensive documentation for your code to facilitate easier understanding and maintenance.\n3. **Refactor Regularly**: Regularly refactor code to improve its structure and eliminate technical debt.\n4. **Use Version Control**: Utilize version control systems to track changes and collaborate effectively with team members.\n5. **Automate Tests**: Implement automated tests to catch bugs early and ensure code quality.\n\nPreviously, we discussed the importance of regular refactoring to improve code structure.",
                action: "IDEATION",
            },
        },
    },
    {
        user: "{{user}}",
        content: {
            text: "How can I improve internationalization and localization in my application?",
        },
        agent: {
            content: {
                response: "To enhance internationalization and localization in your application, consider the following best practices:\n\n1. **Use Localization Libraries**: Implement localization libraries to manage translations and language-specific content.\n2. **Design for Multiple Languages**: Ensure your application design accommodates different languages and text lengths.\n3. **Support Multiple Time Zones**: Handle date and time formatting to support users in different time zones.\n4. **Test Localization**: Regularly test your application with different language settings to ensure proper functionality.\n5. **Provide Language Switcher**: Include a language switcher in your application to allow users to easily change languages.\n\nIn our last discussion, we highlighted the importance of using localization libraries to manage translations.",
                action: "IDEATION",
            },
        },
    },
    {
        user: "{{user}}",
        content: {
            text: "What are some best practices for documentation?",
        },
        agent: {
            content: {
                response: "To improve documentation, consider the following best practices:\n\n1. **Write Clear and Concise Documentation**: Ensure your documentation is easy to read and understand.\n2. **Use Examples**: Provide examples and code snippets to illustrate concepts and usage.\n3. **Keep Documentation Updated**: Regularly update documentation to reflect changes in the codebase and features.\n4. **Organize Documentation**: Structure documentation logically with clear headings and sections for easy navigation.\n5. **Include Troubleshooting Guides**: Provide troubleshooting guides to help users resolve common issues.\n\nPreviously, we discussed the importance of keeping documentation updated to reflect changes in the codebase.",
                action: "IDEATION",
            },
        },
    },
    {
        user: "{{user}}",
        content: {
            text: "How can I promote continuous learning and improvement in my team?",
        },
        agent: {
            content: {
                response: "To foster continuous learning and improvement in your team, consider the following best practices:\n\n1. **Encourage Knowledge Sharing**: Promote a culture of knowledge sharing through regular team meetings, code reviews, and documentation.\n2. **Provide Learning Resources**: Offer access to learning resources such as online courses, books, and workshops.\n3. **Set Learning Goals**: Encourage team members to set personal learning goals and track their progress.\n4. **Conduct Retrospectives**: Regularly conduct retrospectives to reflect on the team's performance and identify areas for improvement.\n5. **Celebrate Achievements**: Recognize and celebrate individual and team achievements to motivate continuous learning and growth.\n\nIn our previous conversation, we emphasized the importance of encouraging knowledge sharing through regular team meetings.",
                action: "IDEATION",
            },
        },
    },
]
`
);

export const reactToIssueTemplate = `
Extract the details for reacting to a specific GitHub issue:
- **owner** (string): The owner of the GitHub repository (e.g., "octocat")
- **repo** (string): The name of the GitHub repository (e.g., "hello-world")
- **branch** (string): The branch of the GitHub repository (e.g., "main")
- **issue_number** (number): The number of the issue to react to (e.g., 1)
- **reaction** (string): The reaction to add (e.g., "+1", "heart")

${contextTemplate}
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "branch": "<branch>",
    "issue_number": "<issue_number>",
    "reaction": "<reaction>"
}
\`\`\`
`;

export const reactToPRTemplate = `
Extract the details for reacting to a specific GitHub pull request:
- **owner** (string): The owner of the GitHub repository (e.g., "octocat")
- **repo** (string): The name of the GitHub repository (e.g., "hello-world")
- **branch** (string): The branch of the GitHub repository (e.g., "main")
- **pullRequest** (number): The number of the pull request to react to (e.g., 1)
- **reaction** (string): The reaction to add (e.g., "+1", "heart")

${contextTemplate}
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "branch": "<branch>",
    "pullRequest": "<pullRequest>",
    "reaction": "<reaction>"
}
\`\`\`
`;

export const closePRActionTemplate = `
Extract the details for closing a specific GitHub pull request:
- **owner** (string): The owner of the GitHub repository (e.g., "octocat")
- **repo** (string): The name of the GitHub repository (e.g., "hello-world")
- **branch** (string): The branch of the GitHub repository (e.g., "main")
- **pullRequest** (number): The number of the pull request to close (e.g., 1)

${contextTemplate}
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "branch": "<branch>",
    "pullRequest": "<pullRequest>"
}
\`\`\`
`;

export const closeIssueTemplate = `
Extract the details for closing a specific GitHub issue:
- **owner** (string): The owner of the GitHub repository (e.g., "octocat")
- **repo** (string): The name of the GitHub repository (e.g., "hello-world")
- **branch** (string): The branch of the GitHub repository (e.g., "main")
- **issue** (number): The number of the issue to close (e.g., 1)

${contextTemplate}
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "branch": "<branch>",
    "issue": "<issue>"
}
\`\`\`
`;

export const mergePRActionTemplate = `
Extract the details for merging a specific GitHub pull request:
- **owner** (string): The owner of the GitHub repository (e.g., "octocat")
- **repo** (string): The name of the GitHub repository (e.g., "hello-world")
- **branch** (string): The branch of the GitHub repository (e.g., "main")
- **pullRequest** (number): The number of the pull request to merge (e.g., 1)
- **mergeMethod** (string): The method to use for merging (e.g., "merge", "squash", "rebase").

${contextTemplate}
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "branch": "<branch>",
    "pullRequest": "<pullRequest>",
    "mergeMethod": "<mergeMethod>"
}
\`\`\`
`;

export const replyToPRCommentTemplate = `
Extract the details for replying to a specific comment in a GitHub pull request:
- **owner** (string): The owner of the GitHub repository (e.g., "octocat")
- **repo** (string): The name of the GitHub repository (e.g., "hello-world")
- **branch** (string): The branch of the GitHub repository (e.g., "main")
- **pullRequest** (number): The number of the pull request (e.g., 1)
- **commentId** (number): The ID of the comment to reply to (e.g., 123)
- **body** (string): The body of the reply (e.g., "Thank you for your feedback!")

${contextTemplate}

Provide the reply details in the following JSON format:

\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "pullRequest": "<pullRequest>",
    "body": "<body>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const generatePRCommentReplyTemplate = `
Generate a reply to a specific comment in a GitHub pull request that aligns with the character's goals and the user's request:
Here is the specific comment to reply to: {{specificComment}} for this pull request: {{specificPullRequest}}
Please provide the most relevant emoji reaction for the comment based on your reply. Allowed values are: "+1", "-1", "laugh", "confused", "heart", "hooray", "rocket", "eyes".

If you don't think there is anything useful to say, return an empty string for the comment and null for the emojiReaction.
Remember these are suggestions and not something that has been implemented yet.

${contextTemplate}

Example:
\`\`\`json
{
    "comment": "<comment>",
    "emojiReaction": "<emojiReaction>"
}
\`\`\`

Examples with emoji reactions:
\`\`\`json
{
    "comment": "Thank you for your feedback!",
    "emojiReaction": "+1"
}
\`\`\`
\`\`\`json
{
    "comment": "I don't think this is the right approach.",
    "emojiReaction": "-1"
}
\`\`\`
\`\`\`json
{
    "comment": "Haha, that's a funny suggestion!",
    "emojiReaction": "laugh"
}
\`\`\`
\`\`\`json
{
    "comment": "I'm not sure I understand what you mean.",
    "emojiReaction": "confused"
}
\`\`\`
\`\`\`json
{
    "comment": "I love this idea!",
    "emojiReaction": "heart"
}
\`\`\`
\`\`\`json
{
    "comment": "Hooray! This is exactly what we needed!",
    "emojiReaction": "hooray"
}
\`\`\`
\`\`\`json
{
    "comment": "This is going to take our project to the next level!",
    "emojiReaction": "rocket"
}
\`\`\`
\`\`\`json
{
    "comment": "I'm keeping an eye on this.",
    "emojiReaction": "eyes"
}
\`\`\`
\`\`\`json
{
    "comment": "",
    "emojiReaction": null
}
\`\`\`

`;

export const implementFeatureTemplate = `
Extract the details for implementing a feature in the GitHub repository:
Ensure the owner, repository, branch, and feature remain unchanged. Provide examples as appropriate:
- **owner** (string): The owner of the GitHub repository (e.g., "octocat")
- **repo** (string): The name of the GitHub repository (e.g., "hello-world")
- **branch** (string): The branch of the GitHub repository (e.g., "realitySpiral/demo")
- **base** (string): The base branch of the GitHub repository (e.g., "develop")
- **feature** (string): The feature to be implemented (e.g., "Replace console.log with elizaLogger.log")

${contextTemplate}
\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "branch": "<branch>",
    "base": "<base>",
    "feature": "<feature>"
}
\`\`\`

Examples:
\`\`\`json
{
    "owner": "octocat",
    "repo": "hello-world",
    "branch": "main",
    "feature": "Replace console.log with elizaLogger.log for better logging"
}
\`\`\`
\`\`\`json
{
    "owner": "octocat",
    "repo": "hello-world",
    "branch": "develop",
    "base": "develop",
    "feature": "Update all API calls to use async/await syntax"
}
\`\`\`
\`\`\`json
{
    "owner": "octocat",
    "repo": "hello-world",
    "branch": "feature/ui-enhancements",
    "base": "develop",
    "feature": "Redesign the user interface for the settings page"
}
\`\`\`

`;

export const orchestrationTemplate = `
**You are a github action orchestrator.** Your role is to analyze the user message and determine the sequence of github actions required to fulfill the request. Both the user message and system message in each github action must be explicitly written in the context of the user's request, ensuring that it aligns precisely with their intent. The github actions must be selected from the predefined list provided in JSON format and structured as JSON arrays.

**Important Instructions:**
1. The following actions are mandatory and must be executed at the beginning of every action sequence in this order:
   - INITIALIZE_REPOSITORY
   - CREATE_MEMORIES_FROM_FILES
2. Only return the list of github actions in JSON format, without any explanations or additional content.
3. Ensure that both the user message and system message in each github action accurately incorporate the specific details from the user's request.
4. Ensure the github actions are logically ordered to achieve the desired outcome efficiently.
5. The output must adhere strictly to the format and examples provided below.

---

Here are the recent user messages for context:
{{recentMessages}}

---

### **Available Github Actions**
Here is the complete list of github actions you can use, where each github action shows an example user message followed by the system's response:
\`\`\`json
{
    "CREATE_COMMIT": {
        "user": "Create a commit in the repository user1/repo1 on branch 'main' with the commit message: 'Fix bug'",
        "system": "Changes commited to repository user1/repo1 successfully to branch 'main'! commit hash: <COMMIT_HASH>"
    },
    "CREATE_ISSUE": {
        "user": "Create an issue in repository user1/repo1 titled 'Bug: Application crashes on startup'",
        "system": "Created issue #<ISSUE_NUMBER> successfully!"
    },
    "CREATE_MEMORIES_FROM_FILES": {
        "user": "Create memories from files on repository octocat/hello-world @ branch main and path 'docs/'",
        "system": "Memories created successfully!"
    },
    "CREATE_PULL_REQUEST": {
        "user": "Create a pull request on repository octocat/hello-world with branch 'fix/something' against base 'develop', title 'fix: something' and files 'docs/architecture.md'",
        "system": "Pull request created successfully! URL: https://github.com/octocat/hello-world/pull/<PR_NUMBER> @ branch: 'fix/something'"
    },
    "INITIALIZE_REPOSITORY": {
        "user": "Initialize the repository user1/repo1 on main branch",
        "system": "Repository initialized successfully! URL: https://github.com/user1/repo1"
    },
    "COMMENT_ON_ISSUE": {
        "user": "Add a comment to issue #1 in repository user1/repo1: 'This is fixed in the latest release'",
        "system": "Added comment to issue #1 successfully! See comment at https://github.com/user1/repo1/issues/1#issuecomment-<COMMENT_ID>"
    },
    "REACT_TO_ISSUE": {
        "user": "React to issue #1 in repository user1/repo1 with a heart",
        "system": "Added reaction to issue #1 successfully!"
    },
    "CLOSE_ISSUE": {
        "user": "Close issue #1 in repository user1/repo1",
        "system": "Closed issue #1 successfully!"
    },
    "REACT_TO_PULL_REQUEST": {
        "user": "React to pull request #1 in repository user1/repo1 with a thumbs up",
        "system": "Added reaction to pull request #1 successfully!"
    },
    "ADD_COMMENT_PR": {
        "user": "Add a comment to pull request #1 in repository user1/repo1: 'This is fixed in the latest release'",
        "system": "Added comment to pull request #1 successfully!"
    },
    "CLOSE_PR": {
        "user": "Close pull request #1 in repository user1/repo1",
        "system": "Closed pull request #1 successfully!"
    },
    "MERGE_PULL_REQUEST": {
        "user": "Merge pull request #1 in repository user1/repo1 using merge method 'squash'",
        "system": "Merged pull request #1 successfully!"
    },
    "REPLY_TO_ALL_PR_COMMENTS": {
        "user": "Reply to all comments in pull request #1 in repository user1/repo1",
        "system": "Replied to all comments in pull request #1 successfully!"
    },
    "MODIFY_ISSUE": {
        "user": "Update issue #1 in repository user1/repo1 to add the label 'bug'",
        "system": "Modified issue #1 successfully!"
    },
    "IDEATION": {
        "user": "Ideate on improving the frontend of user2/repo2",
        "system": "Analyzing the repository and considering previous user feedback, here are some frontend improvement ideas:\n\n1. **Redesign UI for Better UX**: The current design could be more intuitive. Implementing a modern design framework like Material-UI could enhance user experience.\n2. **Improve Accessibility**: Past user feedback has pointed out accessibility issues. Implementing ARIA roles and ensuring color contrast could be beneficial. Consider using tools like Lighthouse to audit accessibility.\n3. **Optimize Asset Loading**: There are opportunities to lazy-load images and scripts to improve page load times, as noted in previous performance audits. This could significantly enhance the user experience on slower networks.\n4. **Enhance State Management**: Transitioning to a more robust state management solution like Redux could address issues raised in past bug reports, particularly those related to data consistency.\n5. **Implement Responsive Design**: Ensuring the application is fully responsive was a common request in user surveys. Use CSS Grid and Flexbox to create a fluid layout that adapts to different screen sizes."
    },
    "GENERATE_CODE_FILE_CHANGES": {
        "user": "Generate code file changes for improving the user experience in repository user1/repo1",
        "system": "Here are the list of code file changes to be made to improve the user experience in repository user1/repo1:\n\n1. **<FILE_PATH_1>**:\n\`\`\`<FILE_CONTENT_1>\n\`\`\`\n2. **<FILE_PATH_2>**:\n\`\`\`<FILE_CONTENT_2>\n\`\`\`\n3. **<FILE_PATH_3>**:\n\`\`\`<FILE_CONTENT_3>\n\`\`\`\n4. etc."
    },
    "FORK_REPOSITORY": {
        "user": "Fork repository user1/repo1",
            "system": "Forked repository user1/repo1 successfully! Fork URL: https://github.com/<OWNER>/repo1"
    }
}
\`\`\`

---

### **Examples**
**Example 1: Implement a new feature**
User: "Plan and implement a new feature to improve user experience in user1/repo1."
\`\`\`json
[
    {
        "githubAction": "INITIALIZE_REPOSITORY",
        "user": "Initialize the repository user1/repo1 on main branch",
        "system": "Repository initialized successfully! URL: https://github.com/user1/repo1"
    },
    {
        "githubAction": "CREATE_MEMORIES_FROM_FILES",
        "user": "Create memories from files on repository user1/repo1 @ branch main and path '/'",
        "system": "Memories created successfully!"
    },
    {
        "githubAction": "IDEATION",
        "user": "Ideate on improving the frontend of user1/repo1",
        "system": "Analyzing the repository and considering previous user feedback, here are some frontend improvement ideas:\n\n1. **<IDEA_TITLE_1>**: <IDEA_DESCRIPTION_1>\n2. **<IDEA_TITLE_2>**: <IDEA_DESCRIPTION_2>\n3. **<IDEA_TITLE_3>**: <IDEA_DESCRIPTION_3>\n4. etc."
    },
    {
        "githubAction": "CREATE_ISSUE",
        "user": "Create an issue for improving the user experience in repository user1/repo1 as a user story and list out all the steps that need to be taken to implement the feature",
        "system": "Created issue #<ISSUE_NUMBER> successfully!"
    },
    {
        "githubAction": "GENERATE_CODE_FILE_CHANGES",
        "user": "Generate code file changes for improving the user experience in repository user1/repo1",
        "system": "Here are the list of code file changes to be made to improve the user experience in repository user1/repo1:\n\n1. **<FILE_PATH_1>**:\n\`\`\`<FILE_CONTENT_1>\n\`\`\`\n2. **<FILE_PATH_2>**:\n\`\`\`<FILE_CONTENT_2>\n\`\`\`\n3. **<FILE_PATH_3>**:\n\`\`\`<FILE_CONTENT_3>\n\`\`\`\n4. etc."
    },
    {
        "githubAction": "CREATE_COMMIT",
        "user": "Create a commit in the repository user1/repo1 on branch 'feature/improve-ux' with the commit message: 'Improve user experience'",
        "system": "Changes commited to repository user1/repo1 successfully to branch 'feature/improve-ux'! commit hash: <COMMIT_HASH>"
    },
    {
        "githubAction": "FORK_REPOSITORY",
        "user": "Fork repository user1/repo1",
        "system": "Forked repository user1/repo1 successfully! Fork URL: https://github.com/<OWNER>/repo1"
    },
    {
        "githubAction": "CREATE_PULL_REQUEST",
        "user": "Create a pull request on repository <OWNER>/repo1 with branch 'feature/improve-ux', title 'Improve user experience' against base 'main'",
        "system": "Pull request created successfully! URL: https://github.com/user1/repo1/pull/<PR_NUMBER> @ branch: 'feature/improve-ux'",
    },
    {
        "githubAction": "MERGE_PULL_REQUEST",
        "user": "Merge pull request #1 in repository user1/repo1 using merge method 'squash'",
        "system": "Merged pull request #1 successfully!"
    },
    {
        "githubAction": "CLOSE_ISSUE",
        "user": "Close issue #1 in repository user1/repo1",
        "system": "Closed issue #1 successfully!"
    }
]
\`\`\`

**Example 2: Bug resolution**
User: "There's a critical bug in the login system of user1/repo1 that needs to be fixed immediately."
\`\`\`json
[
    {
        "githubAction": "INITIALIZE_REPOSITORY",
        "user": "Initialize the repository user1/repo1 on main branch",
        "system": "Repository initialized successfully! URL: https://github.com/user1/repo1"
    },
    {
        "githubAction": "CREATE_MEMORIES_FROM_FILES",
        "user": "Create memories from files on repository user1/repo1 @ branch main and path '/'",
        "system": "Memories created successfully!"
    },
    {
        "githubAction": "CREATE_ISSUE",
        "user": "Create an issue in repository user1/repo1 titled 'Critical Bug: Login System Failure'",
        "system": "Created issue #<ISSUE_NUMBER> successfully!"
    },
    {
        "githubAction": "MODIFY_ISSUE",
        "user": "Update issue #1 in repository user1/repo1 to add the label 'bug'",
        "system": "Modified issue #1 successfully!"
    },
    {
        "githubAction": "GENERATE_CODE_FILE_CHANGES",
        "user": "Generate code file changes to fix the login system in repository user1/repo1",
        "system": "Here are the list of code file changes to be made to fix the login system in repository user1/repo1:\n\n1. **<FILE_PATH_1>**: \`\`\`<FILE_CONTENT_1>\n\`\`\`\n2. **<FILE_PATH_2>**: \`\`\`<FILE_CONTENT_2>\n\`\`\`\n3. **<FILE_PATH_3>**: \`\`\`<FILE_CONTENT_3>\n\`\`\`\n4. etc."
    },
    {
        "githubAction": "CREATE_COMMIT",
        "user": "Create a commit in the repository user1/repo1 on branch 'fix/login-system' with the commit message: 'Fix: Login system critical bug'",
        "system": "Changes commited to repository user1/repo1 successfully to branch 'fix/login-system'! commit hash: <COMMIT_HASH>"
    },
    {
        "githubAction": "FORK_REPOSITORY",
        "user": "Fork repository user1/repo1",
        "system": "Forked repository user1/repo1 successfully! Fork URL: https://github.com/<OWNER>/repo1"
    },
    {
        "githubAction": "CREATE_PULL_REQUEST",
        "user": "Create a pull request on repository <OWNER>/repo1 with branch 'fix/login-system', title 'Fix: Login System Critical Bug' against base 'main'",
        "system": "Pull request created successfully! URL: https://github.com/user1/repo1/pull/<PR_NUMBER> @ branch: 'fix/login-system'"
    },
    {
        "githubAction": "MERGE_PULL_REQUEST",
        "user": "Merge pull request #1 in repository user1/repo1 using merge method 'squash'",
        "system": "Merged pull request #1 successfully!"
    },
    {
        "githubAction": "CLOSE_ISSUE",
        "user": "Close issue #1 in repository user1/repo1",
        "system": "Closed issue #1 successfully!"
    }
]
\`\`\`

**Example 3: Documentation update**
User: "Update the architecture documentation in octocat/hello-world."
\`\`\`json
[
    {
        "githubAction": "INITIALIZE_REPOSITORY",
        "user": "Initialize the repository octocat/hello-world on main branch",
        "system": "Repository initialized successfully! URL: https://github.com/octocat/hello-world"
    },
    {
        "githubAction": "CREATE_MEMORIES_FROM_FILES",
        "user": "Create memories from files on repository octocat/hello-world @ branch main and path '/'",
        "system": "Memories created successfully!"
    },
    {
        "githubAction": "IDEATION",
        "user": "Ideate on improving the architecture of octocat/hello-world",
        "system": "Analyzing the repository and considering previous user feedback, here are some architecture improvement ideas:\n\n1. **<IDEA_TITLE_1>**: <IDEA_DESCRIPTION_1>\n2. **<IDEA_TITLE_2>**: <IDEA_DESCRIPTION_2>\n3. **<IDEA_TITLE_3>**: <IDEA_DESCRIPTION_3>\n4. etc."
    },
    {
        "githubAction": "CREATE_ISSUE",
        "user": "Create an issue in repository octocat/hello-world titled 'Update: Architecture Documentation'",
        "system": "Created issue #<ISSUE_NUMBER> successfully!"
    },
    {
        "githubAction": "GENERATE_CODE_FILE_CHANGES",
        "user": "Generate code file changes to update the architecture documentation in repository octocat/hello-world",
        "system": "Here are the list of code file changes to be made to update the architecture documentation in repository octocat/hello-world:\n\n1. **<FILE_PATH_1>**: \`\`\`<FILE_CONTENT_1>\n\`\`\`\n2. **<FILE_PATH_2>**: \`\`\`<FILE_CONTENT_2>\n\`\`\`\n3. **<FILE_PATH_3>**: \`\`\`<FILE_CONTENT_3>\n\`\`\`\n4. etc."
    },
    {
        "githubAction": "CREATE_COMMIT",
        "user": "Create a commit in the repository octocat/hello-world on branch 'docs/architecture-update' with the commit message: 'docs: Update Architecture Documentation'",
        "system": "Changes commited to repository octocat/hello-world successfully to branch 'docs/architecture-update'! commit hash: <COMMIT_HASH>"
    },
    {
        "githubAction": "FORK_REPOSITORY",
        "user": "Fork repository octocat/hello-world",
        "system": "Forked repository octocat/hello-world successfully! Fork URL: https://github.com/<OWNER>/hello-world"
    },
    {
        "githubAction": "CREATE_PULL_REQUEST",
        "user": "Create a pull request on repository <OWNER>/hello-world with branch 'docs/architecture-update' against base 'main', title 'docs: Update Architecture Documentation' and files 'docs/architecture.md'",
        "system": "Pull request created successfully! URL: https://github.com/octocat/hello-world/pull/<PR_NUMBER> @ branch: 'docs/architecture-update'"
    },
    {
        "githubAction": "REACT_TO_PULL_REQUEST",
        "user": "React to pull request #1 in repository octocat/hello-world with a thumbs up",
        "system": "Added reaction to pull request #1 successfully!"
    },
    {
        "githubAction": "MERGE_PULL_REQUEST",
        "user": "Merge pull request #1 in repository octocat/hello-world using merge method 'squash'",
        "system": "Merged pull request #1 successfully!"
    },
    {
        "githubAction": "CLOSE_ISSUE",
        "user": "Close issue #1 in repository octocat/hello-world",
        "system": "Closed issue #1 successfully!"
    }
]
\`\`\`
`;