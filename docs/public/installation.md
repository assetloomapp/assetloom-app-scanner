---
title: Installation
description: Download a single binary — no runtime required.
---

Each release ships one self-contained binary per platform. These links always point at the **latest release**:

| OS | Arch | Download |
|---|---|---|
| macOS | Apple Silicon | [assetloom-app-scanner-darwin-arm64.tar.gz](https://github.com/assetloomapp/assetloom-app-scanner/releases/latest/download/assetloom-app-scanner-darwin-arm64.tar.gz) |
| macOS | Intel | [assetloom-app-scanner-darwin-x64.tar.gz](https://github.com/assetloomapp/assetloom-app-scanner/releases/latest/download/assetloom-app-scanner-darwin-x64.tar.gz) |
| Linux | x64 | [assetloom-app-scanner-linux-x64.tar.gz](https://github.com/assetloomapp/assetloom-app-scanner/releases/latest/download/assetloom-app-scanner-linux-x64.tar.gz) |
| Linux | arm64 | [assetloom-app-scanner-linux-arm64.tar.gz](https://github.com/assetloomapp/assetloom-app-scanner/releases/latest/download/assetloom-app-scanner-linux-arm64.tar.gz) |
| Windows | x64 | [assetloom-app-scanner-windows-x64.zip](https://github.com/assetloomapp/assetloom-app-scanner/releases/latest/download/assetloom-app-scanner-windows-x64.zip) |

Older versions are on the [releases page](https://github.com/assetloomapp/assetloom-app-scanner/releases). Check your version with `assetloom-app-scanner -v`.

## macOS / Linux

```bash
tar xzf assetloom-app-scanner-darwin-arm64.tar.gz
mv assetloom-app-scanner /usr/local/bin/
```

On macOS, if Gatekeeper blocks the binary, clear the quarantine flag: `xattr -d com.apple.quarantine /usr/local/bin/assetloom-app-scanner`.

## Windows

Extract `assetloom-app-scanner.exe` from the `.zip` and put it somewhere on your `PATH`.

## From source

Alternatively, clone [the repo](https://github.com/assetloomapp/assetloom-app-scanner) and run with Node 26+ (`node src/cli.ts`) — no build step needed.
