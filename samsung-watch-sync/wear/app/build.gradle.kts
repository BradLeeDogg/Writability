plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.watchsync.wear"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.watchsync.wear"
        // Watch4 ships Wear OS 3 / API 30. Health Services needs 30+.
        minSdk = 30
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.activity:activity-ktx:1.9.0")
    implementation("androidx.lifecycle:lifecycle-service:2.8.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    // await() over the ListenableFutures that Health Services returns
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-guava:1.8.1")

    // Google's Health Services — the only sensor API open to third-party apps.
    implementation("androidx.health:health-services-client:1.0.0-rc02")
    implementation("com.google.guava:guava:33.2.1-android")

    // Wear UI
    implementation("androidx.wear:wear:1.3.0")
}
