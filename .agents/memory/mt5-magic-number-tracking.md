---
name: MT5 magic-number tracking
description: Cross-account pause semantics and concurrency rules for magic-number uploads.
---

**Rule:** Tracking state is global to a magic number across MT5 accounts. Pausing deletes existing trades and ignores future uploads until re-enabled; re-enabling collects only new trades.

**Why:** The dashboard groups strategies by magic number. Without serializing ingestion against pause/delete, an upload racing with a pause could be inserted after history was cleared and appear while monitoring is off.

**How to apply:** Keep tracking status keyed by magic number, and perform ingestion's status check and trade inserts transactionally while locking the corresponding tracking rows. Do not restore old history when re-enabling.