# Finite local connection diagnosis — difficulty-r1

## Conclusion

Two independent physics implementation problems were found and isolated:

1. Native fan splitting of the new thin 16-vertex plank created a 0.8645-unit top fragment. A normal high release penetrated it and exposed an internal diagonal as a contact surface. The equal-mass single-convex 8-point plank resolved the same drop correctly. See `NATIVE_FIXTURES_ANALYSIS.md`. Current paper/plank/fridge have one native 8-point fixture each, verified in `NATIVE_CURRENT_FIXTURES.json`.
2. Motor joints initially stored the still-overlapping first-contact pose. Contact resolution pushed bodies apart while the position-feedback motor pulled toward that penetrated target. Actual lower/upper basketball joints applied nearly -1500 N downward despite the seven-body assembly sleeping. Correcting only the joint target along the measured contact normal to Box2D's allowed -0.16-unit penetration removed the false static load: approximately +181 N / +137 N, matching the true weight supported. No body was repositioned and collisions stayed enabled.

A target-only fix did not eliminate later feedback oscillation under the eighth load. Finite speed-resisting connections (`correctionFactor=0`) plus the existing real-contact angular damping 6 remove the center trajectory's failure while preserving its strict stability threshold. Four fixed-action probes show that this does not yet make the whole opening forgiving: dumbbell-on-fridge support width remains insufficient for the tested offsets. The -15 case fails before a basketball is present, so that failure cannot be basketball joint feedback.

## Counterfactual evidence and limits

All runs used ordinary automatic Cocos 3.8.8 / Box2D WASM frames, the same cyclic six-object order, real controller release after 0.18 active seconds, unchanged 1.5-second contact handoff and unchanged true strict placement/settlement rules. They are bounded QA actions, not human success rates. Tested compiled bundle hashes and every temporary override appear in `motor-bias0-contactdamping6.json`. The runtime source target fix had not yet been rebuilt for these runs; the equivalent correction was applied once at joint creation in the probe. Source hashes alone must not be presented as compiled-build acceptance.

No pose edits, fabricated contacts, collision disabling, whole-tower freeze, force increases, or stability/scoring overrides were used. Non-basketball `contactAngularDamping=6` is a temporary ObjectSpec override; the existing hook applies on **any real contact**, including a side contact, and restores the original 1.5 when all contacts end. Basketball keeps its existing 6/.1 behavior. This is not a new support-normal-only damping system.

| Probe | Corrected targets | Feedback | Other change | Center outcome |
|---|---|---|---|---|
| `motor-original.json` | None | ball .4 / plank .3 | None | 8 confirmed, ended |
| `motor-contact-target.json` | Ball only | .4 / .3 | None | 7 confirmed, ended; false static force removed |
| `motor-both-contact-target.json` | Both | .4 / .3 | None | 8 confirmed, ended |
| `motor-both-bias0.json` | Both | 0 / 0 | None | 10 truly confirmed, alive; final continuous-stability observation timed out |
| `motor-both-velocity20.json` | Both | .4 / .3 | velocity iterations 20 (normally 10) | 8 confirmed, ended |
| `motor-both-bias005.json` | Both | .05 / .05 | None | Center 9 confirmed then ended; alternating 4 confirmed then ended |
| `motor-bias0-contactdamping6.json` | Both | 0 / 0 | Real-contact angular damping 6 | Center 10 confirmed and strict terminal stability passed |

The zero-feedback-only timeout was actual low-amplitude residual sway, not a repeated patch keeping bodies awake: ten bodies were confirmed, but sample speeds around 25.55s briefly reached .132/.130 above the unchanged .12 threshold. A fresh .65-second stable window did not finish before the ten-second observation deadline. Each joint override was assigned only once at attach.

## Latest four fixed actions

| Scenario | Released | Truly confirmed | Terminal outcome | Active time |
|---|---:|---:|---|---:|
| center10 | 10 | 10 | survived_and_confirmed | 24.067s |
| alternating10 | 10 | 7 | ended | 23.200s |
| fridge_plus15 | 10 | 9 | ended | 21.166s |
| fridge_minus15 | 5 | 4 | ended | 11.200s |

No page errors occurred. Center finished with maximum absolute final angle 0.369 degrees; all ten released objects remained supported and satisfied the original final stability rule. This is the sole complete pass of this group; three failed offset cases must remain visible in acceptance.

## Remaining support geometry limit

Current fridge highest flat edge: x = [-48.001567, 47.740334], width 95.741901 world units. Dumbbell flat-foot inner boundaries are -35.729614 and +35.729614. The horizontal translation interval for both feet to have nonzero overlap with the highest fridge flat is approximately [-12.271953, +12.010720] relative to the fridge. This is a geometric calculation for level bodies, not an invisible support allowance.

The tests request fridge ±15 while the following dumbbell goes to world x=0, or alternating object x=-10/+10 giving about 20 units of relative offset. Both exceed that flat support interval. Before the alternating sixth release, the dumbbell was already at 5.99 degrees while the lower four objects stayed under .3 degrees. In the fridge -15 run, dumbbell angle progressed 0 → -3.045 → -14.231 degrees between 8.0s and 8.333s; only five objects existed. The missing foot's encounter with the fridge bevel is consistent with the actual visible/physical outline and this trajectory; this run did not capture pre-9s native normals, so that normal direction is an inference, not a claimed measurement.

The next geometry decision should explicitly choose a forgiving **relative placement interval**, then make the visible bearing surface match it. To cover a 20-unit relative offset with the current dumbbell foot gap requires a fridge flat edge wider than 111.459228 units, with additional positive overlap for margin; alternatively bring the dumbbell's real visible feet inward. Simply increasing friction or glue feedback cannot create a missing support surface. Any geometry change needs matching artwork and actual native-fixture verification, not an invisible widened collider.

## Runtime candidate and pending verification

- Source has the minimal shared contact-target correction and the raw native-angle helper used by both connection types.
- After this diagnostic, the parent adopted zero feedback. Both source correction factors are now 0; parent will set the five non-basketball contactAngularDamping fields to 6 alongside the wider visible fridge mapping. The table above still describes its actual QA-only compiled counterfactual and is not retroactively formal-build evidence.
- Keep the finite force/torque budgets and existing separation/angle break checks. Zero feedback does not actively pull back coordinates or level angles.
- Next compiled build must rerun mechanism boundaries, including the new target-initialization test that proves offset correction without moving either body. Previous nine boundary passes are from the earlier build and do not prove the not-yet-built target helper.
- Higher solver iterations and additional feedback parameter searches are not recommended by the observed results.

## Final compiled mechanism follow-up

The parent integrated the real 150-wide fridge, five contactAngularDamping=6 fields, both correctionFactor=0 values and the shared contactOffset helper into one build. The final compiled mechanism suite passed 11/11 with zero page errors (`STABILIZER.json`, `stabilizer-final-r3.stdout.log`). Both basketball sides and plank target initialization had target error exactly 0 and bodyMoved exactly 0; normal corrections were 0.425793, 0.867542 and 1.902241 world units. The ordinary damping test measured 1.5 in flight, 6 on support, 1.5 after genuine contact loss.

The final three base shapes again each have one native 8-point fixture (`NATIVE_CURRENT_FIXTURES.json`); native/source area ratios differ from 1 by at most 2.74e-7. Compiled main SHA256: `6d102717a6c074990a1e9dbe7910f68b4d20607a8a3b0c10237d5416e675334e`. These final mechanism records are anchored to BUILD_REPORT, and TowerWorld source hash matched it. Ordinary difficulty acceptance remains in the separate QA agent final compiled trajectory results; previous 125-wide counterfactual failures above remain historical evidence and are not rewritten as current results.

Final source review against the saved pre-batch baseline found the changes limited to the authorized one-time support cushioning, finite local plank connections, shared joint target/raw-angle correctness, diagnostic snapshots and cleanup. No new physics backend, world support graph, body-position correction, static board welding, increased force budget, or stability/scoring threshold changes were introduced in TowerWorld.
