---
title: Data & privacy
description: Nothing is persisted; nothing leaves your machine except the scan itself.
---

Nothing is persisted: results exist only in memory while the command runs. The only files ever written are the CSV/HTML reports you explicitly request (under `./data/reports/`). Nothing is sent anywhere except the Google Admin SDK calls that perform the scan.

The HTML report is a single self-contained file — it works offline, embeds its data, and phones home to nobody, so it is safe to share internally.
