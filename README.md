# burp-rpc

Burp Suite extension that exposes the [Montoya API](https://portswigger.github.io/burp-extensions-montoya-api/javadoc/burp/api/montoya/MontoyaApi.html) over gRPC, with a TypeScript SDK to control Burp programmatically from Node.js.

```
Burp Suite ──gRPC (0.0.0.0:50051)──► TypeScript / Node.js
```

## Quick Start

### 1. Build the extension

```bash
./gradlew shadowJar
```

Produces `build/libs/burp-rpc.jar`.

### 2. Load in Burp

**Extensions → Add → Java → select `burp-rpc.jar`**

The gRPC server starts on `0.0.0.0:50051`, so it is reachable from other interfaces on the machine.

### 3. Use the SDK

```bash
cd sdk && npm install && npm run build
```

### 4. Run the example

`sdk/test.js` exercises the three main RPCs (proxy history, send request, site map). It connects to the Burp RPC server using two environment variables:

| Variable | Default | Description |
|---|---|---|
| `BURP_RPC_HOST` | `localhost` | Host where the Burp extension is running |
| `BURP_RPC_PORT` | `50051` | gRPC port |

```bash
cd sdk

# Burp running locally
node test.js

# Burp running on another host
BURP_RPC_HOST=10.69.0.2 node test.js

# Custom port
BURP_RPC_HOST=10.69.0.2 BURP_RPC_PORT=9090 node test.js
```

The script prints decoded proxy history entries, sends an HTTP request through Burp, and lists site map entries. If the server is unreachable it exits with a clear error message.

### SDK usage

```javascript
const { BurpClient, decodeBase64Body } = require("@burp-rpc/sdk");

const burp = new BurpClient({ host: "localhost", port: 50051 });

const history = await burp.proxy.getHistory();
const res = await burp.http.sendRawRequest(
  "example.com", 443, true,
  "GET / HTTP/1.1\r\nHost: example.com\r\n\r\n"
);
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
