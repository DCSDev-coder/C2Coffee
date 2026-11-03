import java.io.FileInputStream
import java.io.File
import java.util.Properties

plugins {
    id("com.android.application")
    id("com.google.gms.google-services")
    id("com.google.firebase.crashlytics")
    // The Flutter Gradle Plugin must be applied after the Android and Kotlin Gradle plugins.
    id("dev.flutter.flutter-gradle-plugin")
}

val keystoreProperties = Properties()
val signingPropertiesPath = System.getenv("C2_ANDROID_SIGNING_PROPERTIES")
    ?.takeIf { it.isNotBlank() }
    ?: File(System.getProperty("user.home"), ".c2coffee-signing/key.properties").absolutePath
val keystorePropertiesFile = file(signingPropertiesPath)

if (keystorePropertiesFile.exists()) {
    keystoreProperties.load(FileInputStream(keystorePropertiesFile))
}

fun signingValue(environmentName: String, propertyName: String): String? =
    System.getenv(environmentName)?.takeIf { it.isNotBlank() }
        ?: (keystoreProperties[propertyName] as? String)?.takeIf { it.isNotBlank() }

val releaseKeyAlias = signingValue("C2_ANDROID_KEY_ALIAS", "keyAlias")
val releaseKeyPassword = signingValue("C2_ANDROID_KEY_PASSWORD", "keyPassword")
val releaseStoreFile = signingValue("C2_ANDROID_KEYSTORE_PATH", "storeFile")
val releaseStorePassword = signingValue("C2_ANDROID_STORE_PASSWORD", "storePassword")

fun verifyReleaseKeystore() {
    val missing = listOf(
        "key alias" to releaseKeyAlias,
        "key password" to releaseKeyPassword,
        "keystore path" to releaseStoreFile,
        "store password" to releaseStorePassword,
    ).filter { it.second.isNullOrBlank() }.map { it.first }
    if (missing.isNotEmpty()) {
        throw GradleException(
            "Android release signing is incomplete (${missing.joinToString()}). " +
                "Use C2_ANDROID_* environment variables or $signingPropertiesPath."
        )
    }
    if (!file(releaseStoreFile!!).isFile) {
        throw GradleException("Android release keystore was not found at $releaseStoreFile.")
    }
}

tasks.configureEach {
    if (name.contains("release", ignoreCase = true)) {
        doFirst { verifyReleaseKeystore() }
    }
}

android {
    namespace = "com.c2coffeeandcandle.customer"
    compileSdk = flutter.compileSdkVersion
    ndkVersion = flutter.ndkVersion

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
        isCoreLibraryDesugaringEnabled = true
    }

    defaultConfig {
        applicationId = "com.c2coffeeandcandle.customer"
        // You can update the following values to match your application needs.
        // For more information, see: https://flutter.dev/to/review-gradle-config.
        minSdk = flutter.minSdkVersion
        targetSdk = flutter.targetSdkVersion
        versionCode = flutter.versionCode
        versionName = flutter.versionName
    }

    signingConfigs {
        create("release") {
            keyAlias = releaseKeyAlias
            keyPassword = releaseKeyPassword
            storeFile = releaseStoreFile?.let { file(it) }
            storePassword = releaseStorePassword
        }
    }

    buildTypes {
        release {
            signingConfig = signingConfigs.getByName("release")
        }
    }
}

dependencies {
    coreLibraryDesugaring("com.android.tools:desugar_jdk_libs:2.1.5")
}

kotlin {
    compilerOptions {
        jvmTarget = org.jetbrains.kotlin.gradle.dsl.JvmTarget.JVM_17
    }
}

flutter {
    source = "../.."
}
