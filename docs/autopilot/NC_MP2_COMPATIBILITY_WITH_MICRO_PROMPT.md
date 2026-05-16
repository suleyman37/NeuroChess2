# NC-MP/2 Compatibility With MICRO_PROMPT

## Coexistence

NC-MP/2 can coexist with the existing `NC_SUPERVISOR_RESPONSE` and
`MICRO_PROMPT` protocols. A16C does not require ChatGPT to emit NC-MP/2 live.

## Conversion

The converter can transform a verbose MICRO_PROMPT into NC-MP/2 only when all
required fields already exist:

- id;
- tier;
- type;
- goal;
- allow;
- deny;
- max files;
- max diff;
- checks;
- stop conditions;
- commit policy;
- intent.

The converter must not invent missing allowed paths, forbidden paths, checks, or
stop conditions. It must not reduce safety constraints.

## Future Mode

A later mission may ask ChatGPT to emit NC-MP/2 directly. Until then, NC-MP/2 is
offline tooling for parser, linter, normalizer, conversion, and Mission Hash
compatibility.
