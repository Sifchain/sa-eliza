
export const oodaTemplate = `
    # INSTRUCTIONS:
    Analyze the provided repository files to identify potential improvements based on your character file remember your goals, knowledge, objectives are







    repository: {{repository}}
    owner: {{owner}}
    files: {{files}}

    Instructions:
    Based on your analysis, determine the appropriate action to take. As well as the associated relevant optional parameters. Use the following schema to structure your response:

    Action Schema:
    - action: One of the following actions:
        - "CREATE_ISSUE"
        - "NOTHING"
        - "COMMENT_ISSUE"
        - "COMMENT_PR"
        - "INITIALIZE_REPOSITORY"
        - "CREATE_COMMIT"
        - "CREATE_MEMORIES_FROM_FILES"
        - "CREATE_PULL_REQUEST"
        - "MODIFY_ISSUE"
        - "ADD_COMMENT_TO_ISSUE"
    - owner: (optional) The owner of the repository.
    - repo: (optional) The repository name.
    - path: (optional) The file path related to the action.
    - branch: (optional) The branch name for the action.
    - title: The title for the action, if applicable (e.g., pull request title).
    - description: (optional) A detailed description of the action.
    - files: An array of objects, each containing:
        - path: The file path.
        - content: The file content.
    - message: (optional) A message related to the action.
    - labels: (optional) An array of labels to associate with the action.
    - issue: (optional) The issue number related to the action.
`