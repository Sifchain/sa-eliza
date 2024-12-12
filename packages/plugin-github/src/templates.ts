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
- **path** (string): The path to the files in the GitHub repository (e.g., "docs/")

Provide the repository details in the following JSON format:

\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "path": "<path>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const createPullRequestTemplate = `
Extract the details for creating a pull request in the GitHub repository:
- **owner** (string): The owner of the GitHub repository (e.g., "octocat")
- **repo** (string): The name of the GitHub repository (e.g., "hello-world")
- **branch** (string): The branch of the GitHub repository (e.g., "main")
- **path** (string): The path to the files in the GitHub repository (e.g., "docs/")
- **title** (string): The title of the pull request (e.g., "Add new documentation")
- **description** (string): The description of the pull request (optional)

Provide the pull request details in the following JSON format:

\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "branch": "<branch>",
    "path": "<path>",
    "title": "<title>",
    "description": "<description>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const createCommitTemplate = `
Extract the details for creating a commit in the GitHub repository:
- **owner** (string): The owner of the GitHub repository (e.g., "octocat")
- **repo** (string): The name of the GitHub repository (e.g., "hello-world")
- **message** (string): The commit message (e.g., "Update documentation")
- **files** (array): An array of files to commit with their content

Provide the commit details in the following JSON format:

\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
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

export const createIssueTemplate = `
Extract the details for creating a GitHub issue:
- **owner** (string): The owner of the GitHub repository (e.g., "octocat")
- **repo** (string): The name of the GitHub repository (e.g., "hello-world")
- **title** (string): The title of the issue (e.g., "Add new documentation")
- **body** (string): The body of the issue (e.g., "Add new documentation")
- **labels** (array): The labels of the issue (optional)

Provide the issue details in the following JSON format:

\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "title": "<title>",
    "body": "<body>",
    "labels": ["<label1>", "<label2>"]
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;

export const modifyIssueTemplate = `
Extract the details for modifying a GitHub issue:
- **owner** (string): The owner of the GitHub repository (e.g., "octocat")
- **repo** (string): The name of the GitHub repository (e.g., "hello-world")
- **issue_number** (number): The number of the issue (e.g., 1)
- **title** (string): The title of the issue (e.g., "Add new documentation") (optional)
- **body** (string): The body of the issue (e.g., "Add new documentation") (optional)
- **state** (string): The state of the issue (e.g., "open", "closed") (optional)
- **labels** (array): The labels of the issue (optional)

Provide the issue details in the following JSON format:

\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
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
Extract the details for adding a comment to a GitHub issue:
- **owner** (string): The owner of the GitHub repository (e.g., "octocat")
- **repo** (string): The name of the GitHub repository (e.g., "hello-world")
- **issue_number** (number): The number of the issue (e.g., 1)
- **comment** (string): The comment to add (e.g., "Add new documentation")

Provide the comment details in the following JSON format:

\`\`\`json
{
    "owner": "<owner>",
    "repo": "<repo>",
    "issue_number": "<issue_number>",
    "comment": "<comment>"
}
\`\`\`

Here are the recent user messages for context:
{{recentMessages}}
`;
