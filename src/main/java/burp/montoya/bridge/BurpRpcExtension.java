package burp.montoya.bridge;

import burp.api.montoya.BurpExtension;
import burp.api.montoya.MontoyaApi;

import java.util.concurrent.Executors;

/**
 * Burp RPC Extension - Exposes Montoya API via gRPC on localhost:50051.
 * Runs the gRPC server asynchronously to prevent Burp UI freezes.
 */
public class BurpRpcExtension implements BurpExtension {

    private static final int GRPC_PORT = 50051;

    @Override
    public void initialize(MontoyaApi api) {
        api.extension().setName("Burp RPC Bridge");

        // Start gRPC server on a background thread to avoid blocking Burp's UI
        Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "burp-rpc-grpc-server");
            t.setDaemon(true);
            return t;
        }).execute(() -> {
            try {
                GrpcServer server = new GrpcServer(api, GRPC_PORT);
                server.start();
                api.logging().logToOutput("Burp RPC: gRPC server started on localhost:" + GRPC_PORT);
            } catch (Exception e) {
                api.logging().logToError("Burp RPC: Failed to start gRPC server: " + e.getMessage());
                e.printStackTrace();
            }
        });
    }
}
