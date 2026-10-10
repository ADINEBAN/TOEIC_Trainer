import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { colors, radius, spacing } from "@/src/assets/styles/user-theme";
import SurfaceCard from "@/src/components/user/SurfaceCard";
import UserScreen from "@/src/components/user/UserScreen";
import { useAuth } from "@/src/hooks/use-auth";
import { getUserRoadmap } from "@/src/services/user.service";
import { UserRoadmap } from "@/src/types/user-api";
import { isNoActiveLearningPathError } from "@/src/utils/api-errors";
import { pushRoute } from "@/src/utils/navigation";

const CONFETTI_COLORS = ["#F5B942", "#47C4B4", "#5B8CFF", "#FF8B6A", "#8DDC6F", "#C99CFF"];
const CONFETTI_X = [-110, -70, -25, 25, 70, 110];
const CONFETTI_DELAY = [0, 180, 320, 480, 620, 760];

export default function PathCompleteScreen() {
  const { auth, isHydrated } = useAuth();
  const params = useLocalSearchParams<{ completed?: string; moduleId?: string; pathTitle?: string }>();
  const [loading, setLoading] = useState(false);
  const [roadmap, setRoadmap] = useState<UserRoadmap | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trophyScale = useRef(new Animated.Value(0.92)).current;
  const trophyGlow = useRef(new Animated.Value(0.55)).current;
  const confettiValues = useRef(CONFETTI_COLORS.map(() => new Animated.Value(0))).current;
  const isCompletedFallback = params.completed === "true";
  const fallbackPathTitle = params.pathTitle ? decodeURIComponent(params.pathTitle) : "Chúc mừng bạn đã về đích";

  const loadRoadmap = useCallback(async () => {
    if (!auth.accessToken) return;

    try {
      setLoading(true);
      setErrorMessage(null);
      const response = await getUserRoadmap(auth.accessToken);
      setRoadmap(response.data ?? null);
    } catch (error) {
      setRoadmap(null);
      if (isNoActiveLearningPathError(error)) {
        if (isCompletedFallback) {
          setErrorMessage(null);
          return;
        }
        setErrorMessage("Tài khoản này chưa có roadmap để hoàn thành.");
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Không thể tải thông tin lộ trình.");
    } finally {
      setLoading(false);
    }
  }, [auth.accessToken, isCompletedFallback]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(trophyScale, {
            duration: 1500,
            easing: Easing.inOut(Easing.quad),
            toValue: 1.02,
            useNativeDriver: true,
          }),
          Animated.timing(trophyGlow, {
            duration: 1500,
            easing: Easing.inOut(Easing.quad),
            toValue: 1,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(trophyScale, {
            duration: 1500,
            easing: Easing.inOut(Easing.quad),
            toValue: 0.96,
            useNativeDriver: true,
          }),
          Animated.timing(trophyGlow, {
            duration: 1500,
            easing: Easing.inOut(Easing.quad),
            toValue: 0.55,
            useNativeDriver: true,
          }),
        ]),
      ]),
    ).start();

    const confettiLoops = confettiValues.map((value, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(CONFETTI_DELAY[index]),
          Animated.timing(value, {
            duration: 2400,
            easing: Easing.out(Easing.quad),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            duration: 0,
            toValue: 0,
            useNativeDriver: true,
          }),
        ]),
      ),
    );

    confettiLoops.forEach((loop) => loop.start());
  }, [confettiValues, trophyGlow, trophyScale]);

  useFocusEffect(
    useCallback(() => {
      if (!isHydrated || !auth.accessToken) return;
      loadRoadmap();
    }, [auth.accessToken, isHydrated, loadRoadmap]),
  );

  const moduleCount = roadmap?.milestones.reduce((sum, item) => sum + item.modules.length, 0) ?? 0;
  const completedAtLabel = useMemo(() => {
    if (!roadmap?.completedAt) return "Ngày hôm nay";
    const date = new Date(roadmap.completedAt);
    if (Number.isNaN(date.getTime())) return "Ngày hôm nay";
    return date.toLocaleDateString("vi-VN");
  }, [roadmap?.completedAt]);
  const displayTitle = roadmap?.learningPathTitle ?? fallbackPathTitle;
  const displayStatus = roadmap?.status ?? (isCompletedFallback ? "COMPLETED" : null);

  return (
    <UserScreen contentStyle={styles.content}>
      <SurfaceCard style={styles.heroCard}>
        <View pointerEvents="none" style={styles.confettiLayer}>
          {confettiValues.map((value, index) => {
            const translateY = value.interpolate({
              inputRange: [0, 1],
              outputRange: [-40, 320],
            });
            const rotate = value.interpolate({
              inputRange: [0, 1],
              outputRange: ["0deg", index % 2 === 0 ? "240deg" : "-240deg"],
            });
            const opacity = value.interpolate({
              inputRange: [0, 0.12, 0.9, 1],
              outputRange: [0, 1, 0.7, 0],
            });

            return (
              <Animated.View
                key={index}
                style={[
                  styles.confettiPiece,
                  {
                    backgroundColor: CONFETTI_COLORS[index],
                    opacity,
                    transform: [{ translateX: CONFETTI_X[index] }, { translateY }, { rotate }],
                  },
                ]}
              />
            );
          })}
        </View>

        <Animated.View
          style={[
            styles.glowRing,
            {
              opacity: trophyGlow,
              transform: [{ scale: trophyScale }],
            },
          ]}
        />
        <Animated.View style={[styles.iconWrap, { transform: [{ scale: trophyScale }] }]}>
          <Ionicons color={colors.surface} name="trophy" size={40} />
        </Animated.View>

        <Text style={styles.eyebrow}>KHÓA HỌC ĐÃ HOÀN THÀNH</Text>
        <Text style={styles.title}>
          {displayTitle}
        </Text>
        <Text style={styles.subtitle}>
          {displayStatus === "COMPLETED"
            ? "Bạn đã hoàn thành toàn bộ module trong lộ trình này. Hãy thưởng cho mình một khoảnh khắc ăn mừng nhỏ."
            : "Lộ trình đã được khóa sổ thành tích. Bạn có thể xem lại roadmap hoàn tất và bắt đầu mục tiêu mới."}
        </Text>

        {loading ? (
          <View style={styles.feedbackRow}>
            <ActivityIndicator color={colors.primaryDark} />
            <Text style={styles.feedbackText}>Đang đồng bộ thành tích...</Text>
          </View>
        ) : null}

        {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

        {!loading && errorMessage?.includes("chua co roadmap") ? (
          <Pressable onPress={() => pushRoute("/user/onboarding")} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Bắt đầu onboarding</Text>
          </Pressable>
        ) : null}

        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeValue}>100%</Text>
            <Text style={styles.badgeLabel}>Tiến độ</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeValue}>{moduleCount}</Text>
            <Text style={styles.badgeLabel}>Module xong</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeValue}>{roadmap?.targetScore ?? "--"}+</Text>
            <Text style={styles.badgeLabel}>Mục tiêu</Text>
          </View>
        </View>

        <View style={styles.quoteCard}>
          <Text style={styles.quoteEyebrow}>{roadmap?.learningPathCode ?? "ROADMAP"}</Text>
          <Text style={styles.quoteText}>
            {roadmap?.learningPathDescription ?? "Một hành trình tốt là hành trình được đi đến tận cùng."}
          </Text>
          <Text style={styles.quoteMeta}>Đánh dấu hoàn thành: {completedAtLabel}</Text>
        </View>

        <View style={styles.actionCol}>
          <Pressable onPress={() => pushRoute("/user/practice")} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Xem roadmap đã hoàn thành</Text>
          </Pressable>
          <Pressable onPress={() => pushRoute("/user/home")} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Chọn lộ trình mới</Text>
          </Pressable>
        </View>
      </SurfaceCard>
    </UserScreen>
  );
}

const styles = StyleSheet.create({
  actionCol: {
    gap: spacing.sm,
    marginTop: spacing.lg,
    width: "100%",
  },
  badge: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    flex: 1,
    minWidth: 0,
    padding: spacing.md,
  },
  badgeLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
    width: "100%",
  },
  badgeValue: {
    color: colors.primaryDark,
    fontSize: 20,
    fontWeight: "900",
  },
  confettiLayer: {
    alignItems: "center",
    height: 340,
    left: "50%",
    marginLeft: -12,
    pointerEvents: "none",
    position: "absolute",
    top: 0,
    width: 24,
  },
  confettiPiece: {
    borderRadius: 6,
    height: 14,
    position: "absolute",
    top: 16,
    width: 10,
  },
  content: {
    justifyContent: "center",
    paddingBottom: spacing.xl,
  },
  eyebrow: {
    color: "#C47716",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.3,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  errorText: {
    backgroundColor: "rgba(249,112,102,0.1)",
    borderColor: "rgba(249,112,102,0.24)",
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.danger,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    width: "100%",
  },
  feedbackRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  feedbackText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  glowRing: {
    backgroundColor: "rgba(245,185,66,0.22)",
    borderRadius: 999,
    height: 132,
    position: "absolute",
    top: 36,
    width: 132,
  },
  heroCard: {
    alignItems: "center",
    backgroundColor: "#FFF9EE",
    borderColor: "#F5D69A",
    overflow: "hidden",
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: "#F0A33A",
    borderRadius: radius.pill,
    height: 88,
    justifyContent: "center",
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
    width: 88,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
  },
  quoteCard: {
    backgroundColor: "rgba(255,255,255,0.72)",
    borderColor: "#F0DBB0",
    borderRadius: radius.lg,
    borderWidth: 1,
    marginTop: spacing.lg,
    padding: spacing.md,
    width: "100%",
  },
  quoteEyebrow: {
    color: "#A66A00",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  quoteMeta: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: spacing.sm,
  },
  quoteText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 24,
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingVertical: 15,
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
  },
  title: {
    color: colors.primaryDark,
    fontSize: 30,
    fontWeight: "900",
    lineHeight: 36,
    marginBottom: spacing.sm,
    textAlign: "center",
  },
});
