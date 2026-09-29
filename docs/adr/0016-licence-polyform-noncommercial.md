# 0016. Licence: PolyForm Noncommercial 1.0.0

Date: 2026-09-29
Status: Accepted
Spec: none (licensing is not behaviour); see `LICENSE.md`

## Context
The repository is going public. The owner wants anyone to be able to use and change the code, but not to make money from it. Without a licence nobody may legally use, copy or change the code at all.

## Decision
`LICENSE.md` holds the PolyForm Noncommercial License 1.0.0, verbatim from the PolyForm Project, headed by the line `Required Notice: Copyright 2026 MrSimmo (https://github.com/MrSimmo)`. It covers everything in the repository: code, level data, and the art and audio the code generates.
- Any noncommercial purpose is permitted: personal use, study, hobby projects, and use by charities, schools, public research and government bodies.
- Changes and new works are permitted for those purposes, and so is sharing them, provided the terms (or their URL) and the Required Notice go with every copy.
- Commercial use needs a separate licence from the owner.

Third-party packages keep their own licences: PixiJS, Zod and Workbox are MIT, and the Fredoka and Lilita One fonts are OFL-1.1.

## Alternatives Considered
- **CC BY-NC 4.0 or CC BY-NC-SA 4.0**: the same noncommercial intent, but Creative Commons advises against its licences for software, and they have no patent terms.
- **MIT, Apache-2.0 or GPL**: all allow commercial use.
- **MIT or Apache-2.0 plus the Commons Clause**: a patch on a permissive licence, less clear to read than a licence written for noncommercial use.
- **PolyForm Strict**: forbids changes.

## Consequences
- This is a source-available licence, not an OSI "open source" one, so GitHub's licence detection may not name it.
- Anyone who shares the code or a changed version must pass on the terms and the Required Notice line.
