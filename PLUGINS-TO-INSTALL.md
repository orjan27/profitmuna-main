# Recommended Claude Code Plugins

The following plugins were selected during `/scaffold-app` intake for **profitmuna-main**.

## everything-claude-code _(Universal)_

Performance-optimization bundle: agents, skills, hooks, and rules.

GitHub: <https://github.com/affaan-m/everything-claude-code>

```
/plugin marketplace add https://github.com/affaan-m/everything-claude-code
/plugin install everything-claude-code@everything-claude-code
```

## ui-ux-pro-max-skill _(Frontend)_

Design-system generator with reasoning rules and industry-specific UI recommendations.

GitHub: <https://github.com/nextlevelbuilder/ui-ux-pro-max-skill>

```
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill
```

## impeccable _(Frontend)_

Design guidance plus 18 commands for higher-quality, more original frontend interfaces.

GitHub: <https://github.com/pbakaus/impeccable>

**Install method:** Clone the repo, then run: cp -r dist/claude-code/.claude your-project/

## caveman _(Sanitizer)_

Forces terse replies; cuts ~75% of output tokens while preserving technical accuracy.

GitHub: <https://github.com/JuliusBrussee/caveman>

```
/plugin marketplace add JuliusBrussee/caveman
/plugin install caveman@caveman
```

---

Tip: for plugins with `/plugin` commands above, run each pair inside Claude Code to install. Run `/plugin list` after installing to confirm each plugin is active.
