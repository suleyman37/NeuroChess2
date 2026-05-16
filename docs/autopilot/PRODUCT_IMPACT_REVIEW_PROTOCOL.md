# Product Impact Review Protocol

## Purpose

Product Impact Review records the product value of a mission before longer
autonomous runs continue.

## Format

Reviews use strict JSON with schema version `A16E`. Required fields include:

- mission identity and type;
- targeted, reduced, and created frictions;
- Potential Unlock Loop steps;
- Potential Acceleration Score;
- unlock value;
- revolutionary value verdict;
- fake progress risk;
- why the mission matters;
- evidence;
- recommended next action.

## When To Run

Future integration should run Product Impact Review after Mission Contract,
NC-MP/2, Shadow Plan, and result comparison, then feed the outcome into
Strategic Pulse and Control Plane state.

## Relationship To Forward Progress

Forward Progress asks whether anything useful happened. Product Impact asks
whether that useful thing moved NeuroChess toward the North Star.
