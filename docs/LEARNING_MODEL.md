# Learning model

All competency decisions are deterministic and reproducible - no AI is involved.

* **Unlocked**: every prerequisite concept is mastered. Locked lessons can be previewed; their assessments and dependent missions are refused by the API (HTTP 403).
* **Assessment grading**: choice questions compare the option index; numeric questions accept `|answer − key| ≤ tolerance`. Score = correct / total. Pass ≥ `pass_score` (0.8). The assessment `version` is stored with each attempt.
* **Mastered**: best assessment score ≥ 0.8 **and**, if the concept names a `required_mission`, that mission has a passing submission.
* **Mastery value**: `best_assessment` without a required mission, else `0.6·best_assessment + 0.4·best_mission_score`.
* **Opening a lesson never changes mastery.**
* **Review due**: mastered and not practised for 14 days.
* **Recommendations** (ordered): finish a required mission after passing its assessment → continue in-progress concepts (with a note about failed attempts) → review due → newly available concepts, in topological order.
* **Skill level**: mean mastery of the concepts linked to the skill; `skill_evidence` rows record which assessment or mission demonstrated it.
* **Missions**: `score = Σ weight·category` over correctness (`test_correct_*`), reliability (`test_edge_*`), performance (`test_perf_*`) and static code quality. **Passed** = all correctness tests pass and score ≥ 0.7.
