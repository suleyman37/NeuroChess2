# Private Runner Notes

Do not register a self-hosted runner on the public NeuroChess GitHub repository.

Private runner activation is allowed only when one of these is true:

- GitHub API proves the target repository is private.
- A separate private mirror is explicitly configured and documented.

If enabled later, use a Windows x64 self-hosted runner with the smallest
permissions necessary, no shared secrets in repo logs, and branch protections
that prevent unreviewed `write_sensitive` merges.
