# Project Overview

NeuroChess2 is a local cognitive chess coach. It stores games in SQLite, uses Stockfish via `python-chess` for versioned shallow/deep analysis, builds post-game reviews from durable deep analysis, and turns review moments into practice sessions. The long-term goal is reliable diagnosis and prescribed training, but V6/full Learning Engine/LLM/Memory Loop are not implemented.

Tech stack: Python, FastAPI, SQLite, python-chess, Stockfish UCI, React/Vite/TypeScript, chess.js/react-chessboard for frontend UX.

Primary docs for future missions: `docs/PROJECT_STATE.md`, `docs/AI_COLLABORATION_PROTOCOL.md`, `docs/METRIC_REGISTRY.md`, `docs/ACTION_REGISTRY.md`, `docs/FORMULAS_AND_METRICS.md`, `docs/data_model.md`, `docs/LEARNING_ENGINE_BLUEPRINT.md`, `docs/SCREEN_CONTRACTS.md`.