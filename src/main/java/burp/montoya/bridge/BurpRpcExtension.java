package burp.montoya.bridge;

import burp.api.montoya.BurpExtension;
import burp.api.montoya.MontoyaApi;

import java.util.concurrent.Executors;

/**
 * Burp RPC Extension - Exposes Montoya API via gRPC on 0.0.0.0:50051.
 * Runs the gRPC server asynchronously to prevent Burp UI freezes.
 */
public class BurpRpcExtension implements BurpExtension {

    private static final int GRPC_PORT = 50051;
    private volatile GrpcServer grpcServer;

    @Override
    public void initialize(MontoyaApi api) {
        api.extension().setName("Burp RPC Bridge");

        api.extension().registerUnloadingHandler(() -> {
            if (grpcServer != null) {
                try {
                    grpcServer.stop();
                    api.logging().logToOutput("Burp RPC: gRPC server stopped.");
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        });

        Executors.newSingleThreadExecutor(r -> {
            Thread t = new Thread(r, "burp-rpc-grpc-server");
            t.setDaemon(true);
            return t;
        }).execute(() -> {
            try {
                grpcServer = new GrpcServer(api, GRPC_PORT);
                grpcServer.start();
                api.logging().logToOutput("Burp RPC: gRPC server started on 0.0.0.0:" + GRPC_PORT);
            } catch (Exception e) {
                api.logging().logToError("Burp RPC: Failed to start gRPC server: " + e.getMessage());
                e.printStackTrace();
            }
        });
    }
}
