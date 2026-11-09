# Assignment #6 — NoSQL-Based Project Recommendation Platform

## Purpose and scope

Students and alumni discover projects and signal interest through views, saved projects, ratings and applications. Project owners can review applications and potential candidates. MongoDB stores users with embedded profiles, projects, applications and immutable interaction events; FastAPI exposes the API and React provides the local interface. This is a synthetic educational demonstration, not a production deployment or evidence of recommendation effectiveness.

The embedded profile belongs to a single user and is usually read with that user. Applications and interactions have unbounded cardinality and are separate referenced collections. UUID strings retain identifiers during an offline migration; unique indexes protect email and application pairs. The single-node replica set permits multi-document transactions for applications and interaction events. See [MongoDB transactions](https://www.mongodb.com/docs/manual/core/transactions/) and [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/), accessed 2026-11-07.

The baseline ranks all eligible projects before pagination: 70% required-skill coverage, 20% preferred-category match and 10% career-interest/tag coverage. Zero denominators contribute zero; matches are exact after normalization. The resulting score is a ranking value, not a probability. With no profile signals, projects are ordered by creation time and ID.

## Relevance to the dissertation

The dissertation concerns automatic speech recognition (ASR); the project recommendation domain is an alternative topic. The user confirmed that the alternative and student-project domain were approved. This implementation does not claim a direct empirical connection between project matching and ASR. The shared engineering themes are representation of heterogeneous data, data quality, reproducibility, evaluation and operational constraints, but transferability of any particular algorithm would require independent study. ASR typically involves sequential acoustic data, language models and recognition metrics, whereas this proposal models discrete profiles, projects and behavioural events. Neither the data nor the baseline establishes an improvement in speech recognition.

The database design exercise can still inform general research practice: schemas and versioned data support reproducibility; indexes make explicit the relationship between access patterns and performance; and a time-based evaluation protocol reduces leakage. These ideas are not an assertion that the recommendation system solves an ASR problem. If course requirements later demand a direct dissertation connection, the domain and evaluation must be revised in consultation with the instructor.

## Final Project direction

A future hybrid recommender could combine the content baseline with a behavioural profile built from the latest SAVE/UNSAVE state, latest rating and applications. Repeated views should not automatically increase preference without bound. Evaluate with a temporal split and compare against latest, popularity and content-based baselines using Precision@K, Recall@K and NDCG@K. Synthetic data can validate calculations but cannot prove real-world quality; real data, consent and a properly designed evaluation would be required.
