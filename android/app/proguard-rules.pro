# ProGuard rules for ARN IPTV Pro (Media3 ExoPlayer & Retrofit)
-keep class androidx.media3.** { *; }
-dontwarn androidx.media3.**

-keep class com.arn.iptv.data.model.** { *; }
-keepclassmembers class * {
    @androidx.room.* <fields>;
}
