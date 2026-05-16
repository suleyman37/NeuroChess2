# Prompt Style Guide Learned

## Strong Prompt Traits

- atomic objective;
- explicit allowed and forbidden paths;
- explicit checks;
- small file and diff budget;
- clear stop conditions;
- product friction and unlock value named when relevant;
- no broad language.

## Weak Prompt Traits

- broad verbs such as improve, polish, optimize, or refactor;
- missing checks;
- hidden product scope;
- vague artifacts;
- no product friction or unlock value;
- unclear branch strategy.

## Notes From Current History

- Required checks once failed because they were serialized as one comma-joined
  string; required checks must normalize before comparison.
- Broad prompt risk remains real and must fail closed.
- Missing ChatGPT Project URL caused project navigation failure.
- READY smoke exposed send/composer issues; bridge stages need bounded
  diagnostics.
- Mission Contract mismatch should stop immediately.
