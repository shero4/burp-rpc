package burp.montoya.bridge;

import burp.api.montoya.MontoyaApi;
import io.grpc.Server;
import io.grpc.netty.shaded.io.grpc.netty.NettyServerBuilder;
import io.grpc.netty.shaded.io.netty.channel.ChannelOption;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.concurrent.TimeUnit;

/**
 * gRPC server that exposes Burp Montoya API functionality.
 */
public class GrpcServer {

    private final MontoyaApi api;
    private final int port;
    private Server server;

    public GrpcServer(MontoyaApi api, int port) {
        this.api = api;
        this.port = port;
    }

    public void start() throws IOException {
        server = NettyServerBuilder.forAddress(new InetSocketAddress("0.0.0.0", port))
                .withChildOption(ChannelOption.SO_REUSEADDR, true)
                .addService(new BurpConnectorServiceImpl(api))
                .build()
                .start();

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try {
                stop();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }));
    }

    public void stop() throws InterruptedException {
        if (server != null) {
            server.shutdown().awaitTermination(5, TimeUnit.SECONDS);
        }
    }
}
