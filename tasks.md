- The cached rules have a problem of keeping the error for a changed line if the request fails ✅ -> ❌
  - This actually should happen. because we dont wanna get rid of an error and always replace the new ones.
    the new ones only come up and add on. they are for append, not for replace
- Instead of rules.json, we should use a js or equivalent file ✅
- The LSP works in VSCode, need Zed and other tools' support (especially the AI ones)
  - Neovim ✅
  - VSCode/Cursor ✅
  - OpenCode
  - Zed
- we need context of the project in a separate file
- The comments are too long and in every file ✅

TEST WITH AI:

- Cursor
- VSCode
- Neovim (?)
- OpenCode
