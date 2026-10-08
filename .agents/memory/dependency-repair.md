---
name: Dependency repair constraints
description: Avoid unintended dependency upgrades and private registry URLs during deployment lock-file repairs.
---

For a lock-file-only repair, preserve all existing dependency versions and manifest ranges. Compare the result against the original files before keeping it.

**Why:** The package installer can upgrade a dependency when supplied its existing caret range and introduce internal registry URLs. Those URLs are unsuitable for installs on an external Coolify host.

**How to apply:** Keep only the missing dependency metadata, use public registry URLs with the same verified integrity hashes, and validate full and production npm clean-install resolution in a fresh directory without an existing node_modules tree.
