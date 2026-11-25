# Scout

Scout is a desktop app that takes one company from first look to a proceed or don't-proceed decision. This is **Phase 1: Prepare and Decide**, built from the approved design doc, plus the Stage 1 research agent pulled forward from Phase 2. It covers the first tech area, AI Platforms.

Everything you write stays on your Mac. The store is encrypted and the interface cannot make network requests. The only cloud call is company research, which sends a company's name, website and segment to Claude and nothing else.

## What Phase 1 does

| Area | What you can do |
| --- | --- |
| Workplace Context Pack | Write your team's mission, priorities, AI stack, pain points, constraints (with hard requirements) and problem statements once. Past engagements are added automatically on sign-off. |
| Expert inputs | Paste an expert's email or chat message. Scout pulls out concerns and questions, and you confirm or discard each one. Tag it to one company or all of them. |
| Companies | Add a company by name and website. The profile has 26 fields in six groups: overview (type, HQ, founded, headcount), products and market, money (revenue, valuation or market cap, last round, total funding, investors, acquisitions), people (leadership and talent signals), ecosystem and dependencies (partners, supply chain, local presence) and risk (certifications, competitors, news, controversies). A people list records founders, executives and notable hires and highlights anyone from frontier AI labs or big tech. Every field has a source URL and a checked date, and fields with no source or older than 30 days are flagged. The three pilot companies (Azure AI Foundry, Databricks, LangChain) are pre-loaded with unverified starter facts. |
| Company research | One click runs Claude (`claude-opus-5-5`) with web search and web fetch. It proposes every profile field with its sources, an as-of date and a confidence level, plus a summary and the people list. Any source URL that never appeared in the agent's own searches or fetches is flagged as "not seen during research". You accept or dismiss each finding, or accept all findings that have a seen source. Accepted fields carry the source and research date into the write-up. |
| Rubric | The fixed-weight AI Platforms rubric: score 1 to 5 with confidence, evidence and a source. Hard requirements from the Context Pack are checked per company. |
| Fit map | Augmentation hypotheses in the form "if we used X for problem Y, we expect Z, measured by M". Accept, edit or reject each one. |
| Question bank | Built from low-confidence rubric criteria, accepted hypotheses, confirmed expert concerns and the standard AI Platforms set. Each question has a priority, rubric and hypothesis links, what a good answer and a red flag look like, and follow-ups. Rebuilding only adds what is new, so your edits are kept. You can copy a list of open points to send to an expert. |
| Brief and speaker notes | A 1-page brief (why it matters, three things we must learn, our opening), timed speaker notes, and what we can and cannot share. Export to Markdown, Word or PDF. |
| Meeting notes | Typed notes, a must-ask coverage bar, per-question state (not asked, asked, partly answered, answered), red flags and follow-ups owed. Starting the meeting saves the pre-meeting scores so the write-up can show what changed. |
| Write-up | Drafted from everything above, in the design doc's structure, with numbered sources for every claim. Claims without a source are marked `[no source]` and counted. Scout suggests Proceed, Hold or Do not proceed; you make the call, with a written reason if you differ. Sign-off records the outcome in the Context Pack, and a Hold opens a new round with open must-asks carried forward. Export to Markdown, Word or PDF. |

### How the recommendation is suggested

- Any failed hard requirement means **Do not proceed**, whatever the score.
- A weighted score of **3.5 or more**, with every hard requirement passed and every must-ask answered, suggests **Proceed**.
- A weighted score under **2.5** suggests **Do not proceed**.
- Anything else is **Hold**, with the reasons listed.

The weighted score is the mean over scored criteria only, and the app shows how much of the rubric weight is scored.

## Getting started

You need Node.js 20 or later.

```bash
npm install
npm run dev        # run the app with hot reload
```

Other commands:

```bash
npm test           # unit tests
npm run typecheck  # TypeScript check
npm run build      # production build into out/
npm run dist:mac   # build a .dmg (unsigned) into dist/
```

## Company research

Research needs an Anthropic API key. Add it in **Settings → Company research**. It is kept in the encrypted store, and the interface can only set it or check that it exists. If no key is saved, Scout uses `ANTHROPIC_API_KEY` from the environment.

A run takes a few minutes and costs roughly a few dollars in API usage, depending on how much the agent reads. Only the company's name, website and segment are sent. If a safety classifier declines a request, the API retries it on a fallback model (`fallbacks: "default"`).

## Optional: a local model

Scout works fully without a model, using built-in templates. A local model adds drafting help for expert inputs, hypotheses and the brief.

1. Install [Ollama](https://ollama.com) or [LM Studio](https://lmstudio.ai) and download a model (a 7B to 14B instruct model runs well on Apple silicon).
2. In Scout, open **Settings**, pick the provider, press **Test connection**, and choose the model.

The gateway refuses any model address that is not `localhost`, `127.0.0.1` or `::1`, refuses redirects, and the check is in code, not a setting. The write-up itself is always drafted by template so every claim keeps its source.

## Data and privacy

- Data lives in the app's data folder (on macOS, `~/Library/Application Support/scout/`), shown in **Settings**.
- The store is SQLite (via sql.js, so there is no native module to rebuild), written to disk as one AES-256-GCM encrypted file. The key is random and wrapped by Electron `safeStorage`, which uses the macOS Keychain.
- The interface is sandboxed, and every network request from it is blocked. Links to sources open in your browser.
- No telemetry. **Settings → Back up data** saves an encrypted copy that this Mac's key can read.

## Project layout

```
src/
  shared/    domain logic with no Electron or React: types, rubric, question bank,
             brief, recommendation, write-up, Markdown, expert extraction, LLM prompts
  main/      Electron main process: encrypted store, research agent, local model gateway, exports
  preload/   the narrow bridge the interface uses
  renderer/  React interface
tests/       unit tests for shared logic, encryption and the store
```

## Differences from the design doc

- **Store encryption.** The doc says "SQLite plus files, encrypted at rest". Phase 1 encrypts the whole SQLite file with AES-256-GCM and a Keychain-held key rather than using SQLCipher, to avoid native builds. Audio and attachments arrive in Phase 3.
- **Research pulled forward.** The research agent from Phase 2 is included, because a rich, sourced profile matters most when preparing. Shortlisting and automatic rubric scoring are still Phase 2.
- **Pilot companies.** The starter facts are general knowledge as of mid-2026 and carry no source, so they show as "No source" until you confirm them.

## Next phases

- Phase 2, Scout: research agent, cited profiles, rubric scoring and shortlist.
- Phase 3, Engage: on-device transcription, coverage tracking, prompt cards and transcript-linked write-ups.
- Phase 4, Scale: more tech areas, comparison across companies, and importing expert emails and documents.
