plugins {
    java
    id("com.google.protobuf") version "0.9.4"
    id("com.github.johnrengelman.shadow") version "8.1.1"
}

group = "burp.montoya"
version = "1.0.0"

repositories {
    mavenCentral()
}

val grpcVersion = "1.68.1"
val protobufVersion = "3.25.5"

dependencies {
    // Burp Montoya API - provided by Burp at runtime
    compileOnly("net.portswigger.burp.extensions:montoya-api:2025.8")

    // gRPC
    implementation("io.grpc:grpc-netty-shaded:$grpcVersion")
    implementation("io.grpc:grpc-protobuf:$grpcVersion")
    implementation("io.grpc:grpc-stub:$grpcVersion")
    implementation("com.google.protobuf:protobuf-java:$protobufVersion")

    // For @Generated annotation
    compileOnly("javax.annotation:javax.annotation-api:1.3.2")
}

java {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

protobuf {
    protoc {
        artifact = "com.google.protobuf:protoc:$protobufVersion"
    }
    plugins {
        create("grpc") {
            artifact = "io.grpc:protoc-gen-grpc-java:$grpcVersion"
        }
    }
    generateProtoTasks {
        all().forEach { task ->
            task.plugins {
                create("grpc") {}
            }
        }
    }
}


tasks {
    shadowJar {
        archiveBaseName.set("burp-rpc")
        archiveClassifier.set("")
        archiveVersion.set("")
        manifest {
            attributes("Main-Class" to "burp.montoya.bridge.BurpRpcExtension")
        }
        // Exclude Montoya API - Burp provides it
        dependencies {
            exclude(dependency("net.portswigger.burp.extensions:montoya-api:.*"))
        }
    }
    build {
        dependsOn(shadowJar)
    }
}
