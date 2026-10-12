# Vendored classroom libraries

These files are loaded by `index.html` as delayed scripts. They are **not** part of the esbuild main bundle.

- `marked-12.0.0.min.js` — Markdown parser for the exercise board and chat.
- `mathjax-3.2.2/` — MathJax 3 TeX/CHTML runtime for classroom formulas.

Do not use git LFS. Do not add these paths to the JS bundle-size budget.
