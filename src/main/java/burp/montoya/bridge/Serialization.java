package burp.montoya.bridge;

import burp.api.montoya.MontoyaApi;
import burp.api.montoya.core.ByteArray;
import burp.api.montoya.core.Annotations;
import burp.api.montoya.http.HttpService;
import burp.api.montoya.http.message.requests.HttpRequest;
import burp.api.montoya.http.message.responses.HttpResponse;
import burp.api.montoya.proxy.ProxyHttpRequestResponse;
import burp.montoya.bridge.proto.*;

import java.util.Base64;

/**
 * Serialization utilities for converting between Burp Montoya API objects and Protobuf messages.
 * Handles Byte[] to Base64 conversion for HTTP bodies.
 */
public final class Serialization {

    private static final Base64.Encoder BASE64 = Base64.getEncoder();
    private static final Base64.Decoder BASE64_DECODER = Base64.getDecoder();

    private Serialization() {}

    // --- To Protobuf ---

    public static burp.montoya.bridge.proto.HttpService toProtoHttpService(HttpService service) {
        return burp.montoya.bridge.proto.HttpService.newBuilder()
                .setHost(service.host())
                .setPort(service.port())
                .setSecure(service.secure())
                .build();
    }

    public static burp.montoya.bridge.proto.Annotations toProtoAnnotations(Annotations annotations) {
        burp.montoya.bridge.proto.Annotations.Builder builder = burp.montoya.bridge.proto.Annotations.newBuilder();
        if (annotations.hasNotes()) {
            builder.setNotes(annotations.notes());
        }
        if (annotations.hasHighlightColor()) {
            builder.setHighlightColor(annotations.highlightColor().name());
        }
        return builder.build();
    }

    public static HttpRequestMessage toProtoHttpRequest(HttpRequest request) {
        HttpRequestMessage.Builder builder = HttpRequestMessage.newBuilder();
        builder.setHttpService(toProtoHttpService(request.httpService()));
        builder.setRawBytesBase64(bytesToBase64(request.toByteArray().getBytes()));
        return builder.build();
    }

    public static HttpResponseMessage toProtoHttpResponse(HttpResponse response) {
        return HttpResponseMessage.newBuilder()
                .setRawBytesBase64(bytesToBase64(response.toByteArray().getBytes()))
                .build();
    }

    public static ProxyHistoryEntry toProxyHistoryEntry(ProxyHttpRequestResponse entry) {
        ProxyHistoryEntry.Builder builder = ProxyHistoryEntry.newBuilder()
                .setRequest(toProtoHttpRequest(entry.finalRequest()))
                .setHasResponse(entry.hasResponse())
                .setAnnotations(toProtoAnnotations(entry.annotations()))
                .setListenerPort(entry.listenerPort())
                .setEdited(entry.edited());

        if (entry.time() != null) {
            builder.setTimeIso(entry.time().toString());
        }
        if (entry.hasResponse()) {
            builder.setResponse(toProtoHttpResponse(entry.response()));
        }

        return builder.build();
    }

    public static SiteMapEntry toSiteMapEntry(burp.api.montoya.http.message.HttpRequestResponse item) {
        SiteMapEntry.Builder builder = SiteMapEntry.newBuilder()
                .setRequest(toProtoHttpRequest(item.request()))
                .setHasResponse(item.hasResponse())
                .setAnnotations(toProtoAnnotations(item.annotations()));

        if (item.hasResponse()) {
            builder.setResponse(toProtoHttpResponse(item.response()));
        }

        return builder.build();
    }

    // --- From Protobuf ---

    public static HttpRequest toHttpRequest(MontoyaApi api, HttpRequestMessage proto) {
        HttpService service = HttpService.httpService(
                proto.getHttpService().getHost(),
                proto.getHttpService().getPort(),
                proto.getHttpService().getSecure()
        );
        byte[] rawBytes = base64ToBytes(proto.getRawBytesBase64());
        ByteArray byteArray = ByteArray.byteArray(rawBytes);
        return HttpRequest.httpRequest(service, byteArray);
    }

    // --- Helpers ---

    private static String bytesToBase64(byte[] bytes) {
        return BASE64.encodeToString(bytes);
    }

    private static byte[] base64ToBytes(String base64) {
        return BASE64_DECODER.decode(base64);
    }
}
