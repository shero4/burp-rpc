/**
 * Example script using the published burp-rpc npm package.
 *
 * Prerequisites:
 *   1. Burp Suite with the burp-rpc extension loaded
 *   2. npm install or pnpm install in this directory
 *
 * Run:
 *   npm run test
 *   # or
 *   pnpm test
 *
 * With custom host/port:
 *   BURP_RPC_HOST=localhost BURP_RPC_PORT=50051 npm run test
 */

import { BurpClient, decodeBase64Body } from "burp-rpc";

const burp = new BurpClient({
  host: process.env.BURP_RPC_HOST || "localhost",
  port: Number(process.env.BURP_RPC_PORT) || 50051,
});

try {
  // 1. Get the last N proxy history entries
  const lastFive = await burp.proxy.getLastN(5);
  console.log(`Last ${lastFive.length} proxy history entries:\n`);

  for (let i = 0; i < lastFive.length; i++) {
    const entry = lastFive[i];
    if (entry.request?.rawBytesBase64) {
      const raw = decodeBase64Body(entry.request.rawBytesBase64);
      const firstLine = raw.split("\r\n")[0];
      const host = entry.request.httpService?.host ?? "unknown";
      console.log(`  [${i}] ${firstLine}  (${host})`);
    }
  }

  // 2. Send most recent entry to Repeater
  if (lastFive.length > 0) {
    const picked = lastFive[lastFive.length - 1];
    console.log('\nSending most recent entry to Repeater tab "RPC Test"...');
    await burp.repeater.sendFromHistory(picked, "RPC Test");
    console.log("Sent to Repeater.");

    // 3. Fire the same request programmatically
    if (picked.request?.httpService && picked.request.rawBytesBase64) {
      const { host, port, secure } = picked.request.httpService;
      console.log(`\nFiring request to ${host}:${port}...`);
      const res = await burp.http.sendRequest(
        host,
        port,
        secure,
        picked.request.rawBytesBase64
      );
      console.log("Got response:", res.hasResponse);
      if (res.response?.rawBytesBase64) {
        const respRaw = decodeBase64Body(res.response.rawBytesBase64);
        const statusLine = respRaw.split("\r\n")[0];
        console.log("Status:", statusLine);
      }
    }
  } else {
    console.log("\nNo proxy history — browse something through Burp first.");
  }

  // 4. Site map summary
  const sites = await burp.siteMap.getEntries();
  console.log(`\nSite map entries: ${sites.length}`);
} catch (error) {
  if (error?.code === 14) {
    console.error(
      "Could not connect to Burp RPC at " +
        `${process.env.BURP_RPC_HOST || "localhost"}:` +
        `${process.env.BURP_RPC_PORT || 50051}.`
    );
    console.error(
      "Start the Burp RPC extension or set BURP_RPC_HOST/BURP_RPC_PORT."
    );
  } else {
    console.error(error);
  }
  process.exitCode = 1;
} finally {
  burp.close();
}
