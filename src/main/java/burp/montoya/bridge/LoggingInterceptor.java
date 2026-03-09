package burp.montoya.bridge;

import burp.api.montoya.logging.Logging;
import io.grpc.*;

import java.net.InetSocketAddress;
import java.net.SocketAddress;

/**
 * gRPC interceptor that logs every RPC call with client IP, method, duration, and errors.
 */
public class LoggingInterceptor implements ServerInterceptor {

    private final Logging logging;

    public LoggingInterceptor(Logging logging) {
        this.logging = logging;
    }

    @Override
    public <ReqT, RespT> ServerCall.Listener<ReqT> interceptCall(
            ServerCall<ReqT, RespT> call,
            Metadata headers,
            ServerCallHandler<ReqT, RespT> next) {

        String method = call.getMethodDescriptor().getFullMethodName();
        String clientIp = extractClientIp(call);
        long startNanos = System.nanoTime();

        logging.logToOutput(String.format("[RPC] %s from %s — started", method, clientIp));

        ServerCall<ReqT, RespT> wrappedCall = new ForwardingServerCall.SimpleForwardingServerCall<>(call) {
            @Override
            public void close(Status status, Metadata trailers) {
                long durationMs = (System.nanoTime() - startNanos) / 1_000_000;
                if (status.isOk()) {
                    logging.logToOutput(String.format(
                            "[RPC] %s from %s — OK (%d ms)", method, clientIp, durationMs));
                } else {
                    String description = status.getDescription() != null ? status.getDescription() : "";
                    Throwable cause = status.getCause();
                    String causeMsg = cause != null ? " cause=" + cause.getMessage() : "";
                    logging.logToError(String.format(
                            "[RPC] %s from %s — %s: %s%s (%d ms)",
                            method, clientIp, status.getCode(), description, causeMsg, durationMs));
                }
                super.close(status, trailers);
            }
        };

        ServerCall.Listener<ReqT> listener = next.startCall(wrappedCall, headers);

        return new ForwardingServerCallListener.SimpleForwardingServerCallListener<>(listener) {
            @Override
            public void onHalfClose() {
                try {
                    super.onHalfClose();
                } catch (Exception e) {
                    long durationMs = (System.nanoTime() - startNanos) / 1_000_000;
                    logging.logToError(String.format(
                            "[RPC] %s from %s — EXCEPTION: %s (%d ms)",
                            method, clientIp, e.getMessage(), durationMs));
                    throw e;
                }
            }
        };
    }

    private <ReqT, RespT> String extractClientIp(ServerCall<ReqT, RespT> call) {
        Attributes attrs = call.getAttributes();
        SocketAddress remote = attrs.get(Grpc.TRANSPORT_ATTR_REMOTE_ADDR);
        if (remote instanceof InetSocketAddress) {
            InetSocketAddress inet = (InetSocketAddress) remote;
            return inet.getAddress().getHostAddress() + ":" + inet.getPort();
        }
        return remote != null ? remote.toString() : "unknown";
    }
}
