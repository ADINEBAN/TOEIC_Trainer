import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colors, radius, spacing } from "@/src/assets/styles/user-theme";
import AppHeader, { AvatarBadge } from "@/src/components/user/AppHeader";
import SurfaceCard from "@/src/components/user/SurfaceCard";
import UserScreen from "@/src/components/user/UserScreen";
import { useAuth } from "@/src/hooks/use-auth";
import { logout } from "@/src/services/auth.service";
import {
  SPEECHIFY_MODEL,
  SPEECHIFY_VOICE_NAME,
  getSpeechifyApiKey,
  removeSpeechifyApiKey,
  saveSpeechifyApiKey,
  speakTextWithSpeechify,
} from "@/src/services/speechify-tts.service";
import { getMyProfile, getMyStreak, updateMyTargetScore } from "@/src/services/user.service";

export default function ProfileScreen() {
  const { auth, signOut } = useAuth();
  const [targetScore, setTargetScore] = useState<number>(auth.user?.targetScore ?? 0);
  const [fullName, setFullName] = useState<string>(auth.user?.fullName ?? "");
  const [email, setEmail] = useState<string>(auth.user?.email ?? "");
  const [currentLevel, setCurrentLevel] = useState<string>(auth.user?.currentLevel ?? "");
  const [streakDays, setStreakDays] = useState<number>(0);
  const [loggingOut, setLoggingOut] = useState(false);
  const [speechifyApiKey, setSpeechifyApiKey] = useState("");
  const [hasSavedSpeechifyKey, setHasSavedSpeechifyKey] = useState(false);
  const [savingSpeechifyKey, setSavingSpeechifyKey] = useState(false);
  const [testingSpeechify, setTestingSpeechify] = useState(false);

  useEffect(() => {
    if (!auth.accessToken) return;

    async function loadProfile() {
      if (!auth.accessToken) return;
      try {
        const [profileResponse, streakResponse] = await Promise.all([
          getMyProfile(auth.accessToken),
          getMyStreak(auth.accessToken),
        ]);

        setTargetScore(profileResponse.data.targetScore);
        setFullName(profileResponse.data.fullName);
        setEmail(profileResponse.data.email);
        setCurrentLevel(profileResponse.data.currentLevel);
        setStreakDays(streakResponse.data.currentLoginStreak ?? 0);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Không thể tải thông tin cá nhân.";
        Alert.alert("Hồ sơ", message);
      }
    }

    loadProfile();
  }, [auth.accessToken]);

  useEffect(() => {
    void getSpeechifyApiKey().then((key) => {
      setSpeechifyApiKey(key ?? "");
      setHasSavedSpeechifyKey(Boolean(key));
    });
  }, []);

  const displayInitial = useMemo(() => {
    const source = fullName.trim() || email.trim() || "B";
    return source.charAt(0).toUpperCase();
  }, [email, fullName]);

  const increaseTarget = async () => {
    if (!auth.accessToken) return;
    const nextTarget = Math.min(targetScore + 5, 990);
    try {
      const response = await updateMyTargetScore(auth.accessToken, nextTarget);
      setTargetScore(response.data.targetScore);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không thể cập nhật mục tiêu.";
      Alert.alert("Hồ sơ", message);
    }
  };

  const handleSaveSpeechifyKey = async () => {
    if (!speechifyApiKey.trim()) {
      Alert.alert("Giọng đọc Speechify", "Hãy nhập Speechify API key trước.");
      return;
    }

    try {
      setSavingSpeechifyKey(true);
      await saveSpeechifyApiKey(speechifyApiKey);
      setHasSavedSpeechifyKey(true);
      Alert.alert("Giọng đọc Speechify", "Đã lưu API key trên thiết bị này.");
    } catch (error) {
      Alert.alert(
        "Giọng đọc Speechify",
        error instanceof Error ? error.message : "Không lưu được API key.",
      );
    } finally {
      setSavingSpeechifyKey(false);
    }
  };

  const handleRemoveSpeechifyKey = async () => {
    try {
      await removeSpeechifyApiKey();
      setSpeechifyApiKey("");
      setHasSavedSpeechifyKey(false);
      Alert.alert("Giọng đọc Speechify", "Đã xóa API key khỏi thiết bị này.");
    } catch {
      Alert.alert("Giọng đọc Speechify", "Không xóa được API key.");
    }
  };

  const handleTestSpeechify = async () => {
    if (!hasSavedSpeechifyKey) {
      Alert.alert("Giọng đọc Speechify", "Hãy lưu API key trước khi nghe thử.");
      return;
    }

    setTestingSpeechify(true);
    try {
      await speakTextWithSpeechify("The meeting has been rescheduled to Friday afternoon.", {
        disableFallback: true,
        language: "en-US",
        onDone: () => setTestingSpeechify(false),
        onError: () => setTestingSpeechify(false),
      });
    } catch (error) {
      setTestingSpeechify(false);
      Alert.alert(
        "Giọng đọc Speechify",
        error instanceof Error ? error.message : "Không gọi được Speechify.",
      );
    }
  };

  const handleLogout = async () => {
    if (!auth.accessToken || loggingOut) return;

    try {
      setLoggingOut(true);
      await logout(auth.accessToken, auth.tokenType ?? "Bearer");
    } catch {
      // best-effort
    } finally {
      signOut();
      setLoggingOut(false);
      router.replace("/");
    }
  };

  return (
    <UserScreen>
      <AppHeader
        rightSlot={<AvatarBadge label={displayInitial} />}
        subtitle="Thông tin cá nhân"
        title="Hồ sơ học viên"
      />

      <SurfaceCard style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{displayInitial}</Text>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroName}>{fullName || "Chưa cập nhật họ tên"}</Text>
            <Text style={styles.heroEmail}>{email || "Chưa có email"}</Text>
            <View style={styles.levelBadge}>
              <Text style={styles.levelBadgeText}>{currentLevel || "CHƯA XÁC ĐỊNH"}</Text>
            </View>
          </View>
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.statsCard}>
        <Text style={styles.sectionTitle}>Tổng quan học tập</Text>

        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{targetScore}+</Text>
            <Text style={styles.statLabel}>Mục tiêu TOEIC</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{streakDays}</Text>
            <Text style={styles.statLabel}>Ngày học liên tiếp</Text>
          </View>
        </View>

        <Pressable onPress={increaseTarget} style={styles.primaryButton}>
          <Ionicons color={colors.surface} name="trending-up-outline" size={18} />
          <Text style={styles.primaryButtonText}>Tăng mục tiêu thêm 5 điểm</Text>
        </Pressable>
      </SurfaceCard>

      <SurfaceCard style={styles.infoCard}>
        <Text style={styles.sectionTitle}>Thông tin tài khoản</Text>

        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Họ và tên</Text>
          <Text style={styles.infoValue}>{fullName || "--"}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Email</Text>
          <Text style={styles.infoValue}>{email || "--"}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Trình độ hiện tại</Text>
          <Text style={styles.infoValue}>{currentLevel || "--"}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>Mục tiêu hiện tại</Text>
          <Text style={styles.infoValue}>{targetScore} điểm</Text>
        </View>
      </SurfaceCard>

      <SurfaceCard style={styles.speechifyCard}>
        <Text style={styles.sectionTitle}>Giọng đọc Speechify</Text>
        <Text style={styles.speechifyDescription}>
          Dán Speechify API key của bạn để ưu tiên giọng nam {SPEECHIFY_VOICE_NAME} ({SPEECHIFY_MODEL})
          cho phát âm từ vựng và câu ví dụ. Key chỉ lưu trên thiết bị này; nếu chưa có key hoặc
          Speechify lỗi, app sẽ dùng giọng máy mặc định.
        </Text>

        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setSpeechifyApiKey}
          placeholder="Nhập Speechify API key"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          style={styles.speechifyInput}
          value={speechifyApiKey}
        />

        <Text style={styles.speechifyStatus}>
          {hasSavedSpeechifyKey
            ? "Đã lưu key trên thiết bị này. Audio George đã tạo sẽ được cache để nghe lại nhanh hơn."
            : "Chưa lưu key trên thiết bị này."}
        </Text>

        <View style={styles.speechifyActions}>
          <Pressable
            disabled={savingSpeechifyKey}
            onPress={handleSaveSpeechifyKey}
            style={[styles.speechifyPrimaryButton, savingSpeechifyKey ? styles.buttonDisabled : null]}
          >
            <Ionicons color={colors.surface} name="key-outline" size={17} />
            <Text style={styles.speechifyPrimaryButtonText}>
              {savingSpeechifyKey ? "Đang lưu..." : "Lưu API key"}
            </Text>
          </Pressable>

          <Pressable
            disabled={testingSpeechify || !hasSavedSpeechifyKey}
            onPress={handleTestSpeechify}
            style={[
              styles.speechifySecondaryButton,
              testingSpeechify || !hasSavedSpeechifyKey ? styles.buttonDisabled : null,
            ]}
          >
            <Ionicons color={colors.primaryDark} name="volume-high-outline" size={17} />
            <Text style={styles.speechifySecondaryButtonText}>
              {testingSpeechify ? "Đang đọc..." : "Nghe thử George"}
            </Text>
          </Pressable>
        </View>

        {hasSavedSpeechifyKey ? (
          <Pressable onPress={handleRemoveSpeechifyKey} style={styles.removeKeyButton}>
            <Text style={styles.removeKeyText}>Xóa API key khỏi thiết bị</Text>
          </Pressable>
        ) : null}
      </SurfaceCard>

      <Pressable
        disabled={loggingOut}
        onPress={handleLogout}
        style={({ pressed }) => [
          styles.logoutButton,
          pressed ? styles.logoutButtonPressed : null,
          loggingOut ? styles.logoutButtonDisabled : null,
        ]}
      >
        <Ionicons color="#FDECEC" name="log-out-outline" size={18} />
        <Text style={styles.logoutText}>{loggingOut ? "Đang xử lý..." : "Đăng xuất"}</Text>
      </Pressable>
    </UserScreen>
  );
}

const styles = StyleSheet.create({
  avatarLarge: {
    alignItems: "center",
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    height: 84,
    justifyContent: "center",
    width: 84,
  },
  avatarLargeText: {
    color: colors.surface,
    fontSize: 30,
    fontWeight: "900",
  },
  heroCard: {
    marginBottom: spacing.xl,
  },
  heroCopy: {
    flex: 1,
  },
  heroEmail: {
    color: colors.textMuted,
    fontSize: 14,
    marginTop: 4,
  },
  heroName: {
    color: colors.primaryDark,
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 32,
  },
  heroRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.md,
  },
  infoCard: {
    marginBottom: spacing.xl,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 14,
  },
  infoRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: spacing.md,
  },
  infoValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
  },
  levelBadge: {
    alignSelf: "flex-start",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  levelBadgeText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  logoutButton: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#C44C4C",
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.xl,
    paddingVertical: 14,
  },
  logoutButtonDisabled: {
    opacity: 0.78,
  },
  logoutButtonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.99 }],
  },
  logoutText: {
    color: "#FDECEC",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginTop: spacing.lg,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
  },
  sectionTitle: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: spacing.md,
  },
  statItem: {
    backgroundColor: "rgba(255,255,255,0.72)",
    borderRadius: radius.lg,
    flex: 1,
    minWidth: 0,
    padding: spacing.md,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  statValue: {
    color: colors.primaryDark,
    fontSize: 24,
    fontWeight: "900",
  },
  speechifyActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  speechifyCard: {
    marginBottom: spacing.xl,
  },
  speechifyDescription: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
  },
  speechifyInput: {
    backgroundColor: "rgba(255,255,255,0.78)",
    borderColor: colors.border,
    borderRadius: radius.lg,
    borderWidth: 1,
    color: colors.text,
    fontSize: 14,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  speechifyPrimaryButton: {
    alignItems: "center",
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
  },
  speechifyPrimaryButtonText: {
    color: colors.surface,
    fontSize: 13,
    fontWeight: "900",
  },
  speechifySecondaryButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.78)",
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: 11,
  },
  speechifySecondaryButtonText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900",
  },
  speechifyStatus: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: spacing.sm,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  removeKeyButton: {
    alignSelf: "flex-start",
    marginTop: spacing.md,
    paddingVertical: 4,
  },
  removeKeyText: {
    color: "#B42318",
    fontSize: 12,
    fontWeight: "800",
  },
  statsCard: {
    marginBottom: spacing.xl,
  },
  statsGrid: {
    flexDirection: "row",
    gap: spacing.sm,
  },
});
