# Prompt Quality Checklist

A micro-prompt is execution-eligible only when:

- it has one goal;
- it declares a valid risk tier;
- it declares one work type;
- allowed paths are precise;
- forbidden paths are present;
- max files and max diff lines are present;
- required checks are explicit;
- stop conditions are explicit;
- no vague language appears;
- no forbidden scope appears;
- quality score is 8 or higher.

The Prompt Firewall does not trust the self-audit. It checks these constraints
again before any execution can be considered.
