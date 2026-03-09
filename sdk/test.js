const { BurpClient, decodeBase64Body } = require("./dist/index.js");

const burp = new BurpClient({
  host: process.env.BURP_RPC_HOST,
  port: Number(process.env.BURP_RPC_PORT),
});

(async () => {
  try {
    // Proxy history
    const history = await burp.proxy.getHistory();
    for (const entry of history) {
      if (entry.request?.rawBytesBase64) {
        console.log(decodeBase64Body(entry.request.rawBytesBase64));
      }
    }

    // Send a request through Burp
    const res = await burp.http.sendRawRequest(
      "example.com",
      443,
      true,
      "GET / HTTP/1.1\r\nHost: example.com\r\n\r\n"
    );
    console.log("HTTP request sent:", res.hasResponse);

    // Site map
    const sites = await burp.siteMap.getEntries();
    console.log("Site map entries:", sites.length);
  } catch (error) {
    if (error?.code === 14) {
      console.error(
        "Could not connect to Burp RPC at " +
          `${process.env.BURP_RPC_HOST ?? "localhost"}:` +
          `${process.env.BURP_RPC_PORT ?? 50051}.`
      );
      console.error("Start the Burp RPC server or set BURP_RPC_HOST/BURP_RPC_PORT.");
    } else {
      console.error(error);
    }
    process.exitCode = 1;
  } finally {
    burp.close();
  }
})();
