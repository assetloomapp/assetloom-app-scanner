---
title: Installation
description: Download a single binary — no runtime required.
---

Download the archive for your platform from the [latest release](https://github.com/assetloomapp/assetloom-app-scanner/releases/latest), then:

```bash
tar xzf assetloom-app-scanner-darwin-arm64.tar.gz
mv assetloom-app-scanner /usr/local/bin/
```

On macOS, if Gatekeeper blocks the binary, clear the quarantine flag: `xattr -d com.apple.quarantine /usr/local/bin/assetloom-app-scanner`.

On Windows, download the `.zip`, extract `assetloom-app-scanner.exe`, and put it somewhere on your `PATH`.

Alternatively, clone [the repo](https://github.com/assetloomapp/assetloom-app-scanner) and run from source with Node 26+ (`node src/cli.ts`) — no build step needed.
