# Prompt Sharing Library

A lightweight way to share prompts across the OLE team.
Hosted for free with GitHub Pages, backed by simple `.md` files.

## Live site

[https://ole-vi.github.io/prompt-sharing/](https://ole-vi.github.io/prompt-sharing/)

## Repo structure

```
prompt-sharing/
├── index.html      # The app (static single-page site)
└── prompts/        # Markdown prompts live here
    ├── stubs.md
    └── pr-rubric.md
```

## Adding a new prompt

1. Create a new file inside the `prompts/` folder.

   * Use lowercase filenames with no spaces. Example: `my-new-prompt.md`.
   * File must end with `.md`.

2. Start the file with a first-level heading (`#`) for the title:

   ```markdown
   # My New Prompt

   Prompt instructions go here...
   ```

3. Commit the file to the `main` branch:

   * Either upload directly through the GitHub web UI, or
   * Use git locally:

     ```bash
     git add prompts/my-new-prompt.md
     git commit -m "Add my-new-prompt.md"
     git push
     ```

4. After a minute or two, the live site will auto-refresh to include your new prompt.

### Using a Gist pointer

Instead of storing the full prompt in this repo, you can point a prompt file at a GitHub Gist. To do this, create a markdown file whose entire body is the raw Gist URL:

```markdown
https://gist.githubusercontent.com/your-username/abc123456789/raw/my-shared-prompt.md
```

When the site loads this file it will fetch the referenced Gist content, cache it, and render that content in place of the URL.

**Limitations**

* The URL must be a publicly readable `gist.githubusercontent.com` raw link. Private gists or GitHub pages that require auth are not supported.
* Only a single URL is supported in the file body; any extra text will be treated as a normal prompt rather than a pointer.
* Updates to the Gist will appear the next time the site fetches that URL. If you change the pointer to a different Gist, update the URL in the prompt file.

## Linking to prompts

Every prompt has its own URL:

```
https://ole-vi.github.io/prompt-sharing/#p=<filename-without-.md>
```

Example:

* File: `prompts/stubs.md`
* Link: [https://ole-vi.github.io/prompt-sharing/#p=stubs](https://ole-vi.github.io/prompt-sharing/#p=stubs)

These links can be shared in Discord, Whatsapp, docs, etc.

## Features

* Automatic listing of all `.md` files in `/prompts`
* Markdown rendering with headings, lists, code blocks
* One-click Copy prompt button
* Deep linking to specific prompts with `#p=<slug>`
* Automatic emoji tags based on filename keywords (see below)
* No build step, no backend — just static files

## Emoji Titles

The site automatically adds emojis in front of filenames to help visually categorize prompts:

* **🔍** for filenames containing `review`, `pr`, or `rubric`
* **🩹** for filenames containing `bug`, `triage`, or `fix`
* **🧭** for filenames containing `spec`, `design`, or `plan`
* **🧹** for filenames containing `refactor`

If a filename doesn’t match any of these keywords, no emoji is added. Emojis are cosmetic only and don’t affect functionality.

## Notes

* Repo must remain public for GitHub Pages and the GitHub API to fetch the prompts.
* Changes take 1–2 minutes to appear live after pushing to `main`.
* No in-browser editing; prompts are managed via git or the GitHub web interface.
