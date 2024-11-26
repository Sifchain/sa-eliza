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