# Product Roadmap

## Baseline

First release delivered on 2026-03-23.

This document captures future work after v1. It is intentionally separate from the delivered scope and should not be read as part of the first invoice unless a roadmap item is explicitly agreed as follow-up work.

## Current Product Scope

The current release covers these core capabilities:

- ingest ElevenLabs post-call webhooks
- store conversations and extracted answers
- display answers publicly
- allow editors to inspect collected data
- allow editors to manually classify answers
- allow editors to inspect the configured ElevenLabs agent

Not yet delivered:

- configure the ElevenLabs agent directly from the app UI

## Future Work

### Editor UI For Questions And Data Collection

Configure interview questions and the corresponding data collection points together in the app UI.

### ElevenLabs Branch-Based E2E Test Setup

Use ElevenLabs branches for E2E tests that write to the ElevenLabs API, with automatic cleanup of ephemeral branches.

### Auto-Classification Before Manual Review

Classify answers automatically before an editor reviews them manually.

### Classification Type Management

Create and edit classification types in the app.

### Public Dialogbank Visibility Configuration

Configure which classifications and answers are shown in the public Dialogbank UI.

### Infrastructure As Code For DNS And Sentry

Manage DNS records and Sentry configuration as infrastructure code so environment changes do not require manual reconfiguration such as updating webhook targets.
