# Relevance label review

**Status: assistant-reviewed on 2026-11-14, waiting for user sign-off.** Every query in `backend/app/data/retrieval_queries.json` has `label_status: assistant_reviewed_pending_user`. That means labels were checked for consistency against all 58 catalog records, but **no human has confirmed them**. Do not describe the benchmark as human-labeled until the sign-off below is done.

## Policy used

A catalog record is **relevant** to a query when a student who solved the record would **directly reuse its main idea** on the query.

- Variants that keep the same core method count. Examples: range maximum vs. range minimum with a sparse table; bottleneck vs. total-cost spanning tree; subset-sum feasibility vs. 0/1 value knapsack.
- **Hard negatives are not relevant**, even though they share a topic. These are near misses that need a different method. Examples: a static array vs. one with updates; weighted vs. unweighted interval selection; sorted vs. unsorted pair search; a general nonnegative-weight graph vs. the 0/1-weight special case.
- A method that merely *also works* is not counted when the query targets something simpler or different. For example, Bellman–Ford also solves nonnegative shortest paths, but those queries target Dijkstra.

## Changes made

| Query | Split | Change | Reason |
|---|---|---|---|
| `stateful_choices` | dev | Query **rewritten**; relevant set 6 → 9 records (every record whose main technique is dynamic programming or knapsack) | The old text listed the six records it was meant to find, which inflated scores. |
| `battery_paths`, `rising_noncontiguous`, `one_use_equipment` | dev | Category → `same_algorithm_different_story` | The old category names did not describe the queries. Categories are descriptive only and do not change metrics. |
| `one_use_equipment` | dev | + `exact_weight_check` | Same single-use item DP. Matches the existing `exact_parcel` → `rucksack_value` judgment. |
| `unique_streak` | test | + `distinct_badges` | Same character-count sliding window. This *lowers* the measured recall, so it is not a self-serving change. |
| `mixing_desk_levels` | test | + `scoreboard_bonuses` (new) | Fenwick point updates with range/prefix sums. |
| `cheapest_day_lookup` | test | + `tallest_wave_lookup` (new) | Same static range query (max vs. min). |
| `lake_regions` | test | + `paint_bucket` (new) | Counting regions is repeated flood fill. |
| `token_corridors` | test | + `wall_breaker` (new) | Zero/one edge-weight shortest path. |
| `rebate_loop` | test | + `arbitrage_alarm` (new) | Negative-cycle detection. |
| `pipeline_layout` | test | + `bottleneck_cables` (new) | Same spanning-tree method. |
| `pair_to_target` | test | + `price_gap_pairs` (new) | Hash-map complement lookup. |
| `org_chart_manager` | test | + `kth_ancestor_lookup` (new) | Binary-lifting ancestor jumps. |
| 6 new queries | test | Added with no relevant records | Out-of-catalog topics (string matching, primes, huge-N recurrence, impartial games, max flow, convex hull) for the "no close match" notice. Written before that rule existed. |

The cue weight was **not** changed after relabeling. The dev sweep is flat between 0.15 and 0.4 (within 0.02), and re-tuning on 14 queries would chase noise. See RETRIEVAL.md.

## Your sign-off (about 20 minutes)

For each query, read its text and the listed `relevant_ids` in the catalog, then mark it here. If you disagree, edit the JSON, run `python -m app.retrieval.catalog_check --strict` and the evaluation, and note the change. When every row is checked, change `label_status` to `user_reviewed` (and update `test_labels_are_marked_assistant_reviewed_not_human_reviewed`).

| Query | Agree? | Notes |
|---|---|---|
| dev: capacity_timetables, capacity_music | ☐ | |
| dev: rainfall_intervals, audio_intervals | ☐ | |
| dev: battery_paths, currency_paths | ☐ | |
| dev: signed_balance, room_choices, rising_noncontiguous | ☐ | `envelope_chain` as relevant is the most subjective call |
| dev: prerequisites, one_use_equipment, batch_changes | ☐ | |
| dev: stateful_choices, circle_geometry | ☐ | |
| test: hard negatives (8) | ☐ | |
| test: coverage and multiple-relevant (13) | ☐ | |
| test: no-match (7) | ☐ | |
