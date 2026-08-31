# Design-tokens phase

## Steps 1–4 · schema, candidates, judge, accept (AI, delegated)

Delegate the judgement as one unit. The subagent runs the schema step, judges,
writes its response, and runs acceptance itself until acceptance passes.

```
Agent(
  subagent_type: "general-purpose",
  description:   "judge design tokens",
  prompt: "First read the rubric you judge by:

             .claude/skills/migrate/phases/design-tokens/response-contract.md

           Then run these in order and read every line of the output:

             pnpm tsx src/scripts/tokens/index.ts --project <projectPath> --schema
             pnpm tsx src/scripts/tokens/index.ts --project <projectPath> --candidates

           The first prints the JSON Schema of the response. The second prints the
           exact path for the response file and every candidate that needs a
           verdict.

           Judge every candidate against the rubric and write the response as JSON
           to exactly that path.

           Then accept your own work:

             pnpm tsx src/scripts/tokens/index.ts --project <projectPath> --accept

           Exit code 1 means every error is printed in stdout: fix them ALL,
           rewrite the response at the same path, and run accept again.
           Exit code 0 means the artifact is written — return one line: its path.

           Do not finish before accept returns 0. If you cannot make it pass,
           return the error together with the last accept output.

           Create and modify nothing except the response file."
)
```

**Record the `agentId` from the result.** It is what you need if the phase state
says the steps are not closed.

### After the subagent returns

Do not re-run acceptance yourself. Ask the phase for its state:

```
pnpm tsx src/scripts/tokens/index.ts --project <projectPath> --state
```

It prints one row per step. If `tokens:accept` is `done`, go to step 5. If it is
not, wake the same subagent:

```
SendMessage(
  to: "<agentId from the delegation>",
  summary: "retry tokens accept",
  message: "Acceptance did not pass. Run
            pnpm tsx src/scripts/tokens/index.ts --project <projectPath> --accept,
            fix EVERY error it prints, rewrite the response at the same path, and
            repeat until the exit code is 0. Do nothing else."
)
```

Then read `--state` again.

## Step 5 · theme (script)

```
pnpm tsx src/scripts/tokens/index.ts --project <projectPath> --theme
```

Renders `theme.css` from `design-tokens.json`. It is a separate step from
acceptance on purpose: the theme can be re-rendered without touching the
judgement.

Verify:
`jq '.data.primitive.color | length' <projectPath>/.migration/artifacts/design-tokens.json`
is greater than zero, and eyeball `theme.css` against a capture (brand colour,
font, radius).
