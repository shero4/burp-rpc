# burp-rpc Examples

Example scripts using the [burp-rpc](https://www.npmjs.com/package/burp-rpc) npm package.

## Prerequisites

1. **Burp Suite** with the burp-rpc extension loaded. See the [main README](../README.md#quick-start) for extension setup.
2. **Node.js 18+**

## Quick Start

```bash
# Install dependencies (npm or pnpm)
npm install
# or
pnpm install

# Run the test script
npm run test
# or
pnpm test
```

## Environment Variables

| Variable         | Default       | Description                         |
|------------------|---------------|-------------------------------------|
| `BURP_RPC_HOST`  | `localhost`   | Host where Burp with the extension is running |
| `BURP_RPC_PORT`  | `50051`       | gRPC port                           |

### Examples

```bash
# Burp on another machine
BURP_RPC_HOST=localhost npm run test

# Custom port
BURP_RPC_PORT=9090 npm run test

# Both
BURP_RPC_HOST=localhost BURP_RPC_PORT=50051 pnpm test
```

## What the script does

1. **Proxy history** — Fetches the last 5 proxy history entries and prints each request line.
2. **Repeater** — Sends the most recent entry to a Repeater tab named "RPC Test".
3. **Send request** — Fires the same request through Burp programmatically and prints the response status.
4. **Site map** — Prints the total number of site map entries.

## Using burp-rpc in your own project

```bash
npm install burp-rpc
# or
pnpm add burp-rpc
```

```javascript
import { BurpClient, decodeBase64Body } from "burp-rpc";

const burp = new BurpClient({ host: "localhost", port: 50051 });

// Get last N proxy entries
const recent = await burp.proxy.getLastN(10);

// Send to Repeater
await burp.repeater.sendFromHistory(recent[0], "My Tab");

// Fire a request
const res = await burp.http.sendRawRequest(
  "example.com", 443, true,
  "GET / HTTP/1.1\r\nHost: example.com\r\n\r\n"
);

burp.close();
```

See the [full API docs](https://github.com/shero4/burp-rpc#sdk-api) on the main README.
