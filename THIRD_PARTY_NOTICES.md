# Third-party components

Everything the app loads at runtime is bundled here so that it works offline. Each component keeps its own license.

| Component | Version | Where | License |
|---|---|---|---|
| PDF.js (Mozilla) | 5.4.149 | `app/ui/vendor/pdfjs/` | Apache License 2.0 — `app/ui/vendor/pdfjs/LICENSE`; `web/viewer.html` is modified (two lines marked `MODIFIED by Paper Assistant` load `app/ui/reader-ext.css/js`); bundled resources keep their own licenses, see below |
| xterm.js (`@xterm/xterm`) | 5.5.0 | `app/ui/vendor/xterm/xterm.js`, `xterm.css` | MIT — `app/ui/vendor/xterm/LICENSE-xterm` |
| `@xterm/addon-fit` | 0.10.0 | `app/ui/vendor/xterm/addon-fit.js` | MIT — `app/ui/vendor/xterm/LICENSE-addon-fit` |
| canvas-confetti | 1.9.3 | `app/ui/vendor/canvas-confetti.min.js` | ISC — below |
| Inter (variable, latin + latin-ext subsets) | 4.x | `app/ui/fonts/InterVariable-*.woff2` | SIL Open Font License 1.1 — `app/ui/fonts/LICENSE-Inter.txt` |
| JetBrains Mono Regular | 2.x | `app/ui/fonts/JetBrainsMono-Regular.woff2` | SIL Open Font License 1.1 — `app/ui/fonts/LICENSE-JetBrainsMono.txt` |

## PDF.js bundled resources

Inside `app/ui/vendor/pdfjs/web/`, each license file sits next to the files it covers: `standard_fonts/LICENSE_FOXIT`
(Foxit standard fonts), `standard_fonts/LICENSE_LIBERATION` (Liberation Sans, SIL OFL 1.1), `cmaps/LICENSE` (Adobe CMap
resources), `iccs/LICENSE` (ICC profiles), `wasm/LICENSE_OPENJPEG` and `wasm/LICENSE_PDFJS_OPENJPEG` (OpenJPEG build),
`wasm/LICENSE_QCMS` and `wasm/LICENSE_PDFJS_QCMS` (qcms build).

The paper-survey skill and the Daily gap / Expert features call public scholarly APIs at run time (arXiv, OpenAlex,
Semantic Scholar); their terms of use apply to those requests. Claude Code is a separate product installed by
the user; this repository does not bundle it.

## canvas-confetti (ISC)

```
ISC License

Copyright (c) 2020, Kiril Vatev

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```
