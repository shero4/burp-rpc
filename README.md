# burp-rpc

Burp Suite extension that exposes the [Montoya API](https://portswigger.github.io/burp-extensions-montoya-api/javadoc/burp/api/montoya/MontoyaApi.html) over gRPC, with a TypeScript SDK to control Burp programmatically from Node.js.

```
Burp Suite ──gRPC (localhost:50051)──► TypeScript / Node.js
```

## Quick Start

### 1. Build the extension

```bash
./gradlew shadowJar
```

Produces `build/libs/burp-rpc.jar`.

### 2. Load in Burp

**Extensions → Add → Java → select `burp-rpc.jar`**

The gRPC server starts on `localhost:50051`.

### 3. Use the SDK

```bash
cd sdk && npm install && npm run build
```

```typescript
import { BurpClient, decodeBase64Body } from "@burp-rpc/sdk";

const burp = new BurpClient();

// Proxy history
const history = await burp.proxy.getHistory();
for (const entry of history) {
  console.log(decodeBase64Body(entry.request!.rawBytesBase64));
}

// Send a request through Burp
const res = await burp.http.sendRawRequest(
  "example.com", 443, true,
  "GET / HTTP/1.1\r\nHost: example.com\r\n\r\n"
);

// Site map
const sites = await burp.siteMap.getEntries();

burp.close();
```

## RPCs

| Method | What it does |
|---|---|
| `GetProxyHistory` | All entries from Proxy HTTP history |
| `SendHttpRequest` | Send a request through Burp, get the response |
| `GetSiteMap` | All request/response pairs from the Site Map |

## Requirements

- Java 17+
- Node.js 18+
