import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/src/assets/styles/user-theme";
import AppHeader, { AvatarBadge } from "@/src/components/user/AppHeader";
import ProgressBar from "@/src/components/user/ProgressBar";
import SectionTitle from "@/src/components/user/SectionTitle";
import SurfaceCard from "@/src/components/user/SurfaceCard";
import UserScreen from "@/src/components/user/UserScreen";
import { useAuth } from "@/src/hooks/use-auth";
import { UserTestService } from "@/src/services/user-test.service";
import {
  assignRecommendedPath,
  getLearningPaths,
  getMyStreak,
  getUserRoadmap,
} from "@/src/services/user.service";
import { LearningPath, UserRoadmap, UserTestLeaderboardItem } from "@/src/types/user-api";
import { isNoActiveLearningPathError } from "@/src/utils/api-errors";
import { pushRoute } from "@/src/utils/navigation";

function formatName(fullName?: string | null) {
  if (!fullName?.trim()) return "bạn";
  const parts = fullName.trim().split(/\s+/);
  return parts[parts.length - 1];
}

function getRecommendationLabel(path: LearningPath, targetScore: number) {
  const gap = Math.abs(path.targetScore - targetScore);

  if (gap === 0) return "Khớp đúng mục tiêu";
  if (gap <= 100) return "Rất gần mục tiêu";
  if (path.targetScore < targetScore) return "Cần tăng tốc";
  return "Vượt chuẩn hiện tại";
}

function getPathTone(path: LearningPath) {
  if (path.targetScore >= 800) {
    return {
      accent: "#B85C38",
      glow: "#F5D4B8",
      panel: "#FFF3E8",
      soft: "#F3D8C4",
    };
  }

  if (path.targetScore >= 500) {
    return {
      accent: "#0F6B62",
      glow: "#D9F1E8",
      panel: "#EEF9F6",
      soft: "#D8EEE7",
    };
  }

  return {
    accent: "#295DA8",
    glow: "#DDE8FA",
    panel: "#F2F6FF",
    soft: "#E1EAFB",
  };
}

export default function HomeScreen() {
  const { auth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [assigningPath, setAssigningPath] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [learningPaths, setLearningPaths] = useState<LearningPath[]>([]);
  const [roadmap, setRoadmap] = useState<UserRoadmap | null>(null);
  const [leaderboard, setLeaderboard] = useState<UserTestLeaderboardItem[]>([]);
  const [selectedPathId, setSelectedPathId] = useState<number | null>(null);
  const [streakDays, setStreakDays] = useState(0);

  const fullName = auth.user?.fullName ?? "";
  const targetScore = auth.user?.targetScore ?? 0;
  const greetingName = formatName(fullName);
  const leaderboardService = useMemo(
    () => (auth.accessToken ? new UserTestService(auth.accessToken) : null),
    [auth.accessToken],
  );

  useEffect(() => {
    if (!auth.accessToken) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    Promise.allSettled([
      getLearningPaths(auth.accessToken),
      getUserRoadmap(auth.accessToken),
      leaderboardService?.getLeaderboard(),
      getMyStreak(auth.accessToken),
    ])
      .then(([pathsResult, roadmapResult, leaderboardResult, streakResult]) => {
        if (pathsResult.status !== "fulfilled") {
          throw pathsResult.reason;
        }

        const nextPaths = pathsResult.value.data ?? [];
        const nextRoadmap =
          roadmapResult.status === "fulfilled"
            ? roadmapResult.value.data ?? null
            : isNoActiveLearningPathError(roadmapResult.reason)
              ? null
              : (() => {
                  throw roadmapResult.reason;
                })();
        const nextLeaderboard = [
          ...(leaderboardResult.status === "fulfilled" ? leaderboardResult.value?.data ?? [] : []),
        ]
          .sort((a, b) => b.totalScore - a.totalScore)
          .slice(0, 4);
        const nextStreak =
          streakResult.status === "fulfilled" ? streakResult.value.data?.currentLoginStreak ?? 0 : 0;

        setLearningPaths(nextPaths);
        setRoadmap(nextRoadmap);
        setLeaderboard(nextLeaderboard);
        setStreakDays(nextStreak);

        if (nextRoadmap?.learningPathId) {
          setSelectedPathId(nextRoadmap.learningPathId);
          return;
        }

        const nearestPath = [...nextPaths]
          .filter((path) => path.active)
          .sort(
            (a, b) => Math.abs(a.targetScore - targetScore) - Math.abs(b.targetScore - targetScore),
          )[0];

        setSelectedPathId(nearestPath?.id ?? null);
      })
      .catch((error) => {
        setErrorMessage(
          error instanceof Error ? error.message : "Không thể tải dữ liệu trang chủ.",
        );
      })
      .finally(() => setLoading(false));
  }, [auth.accessToken, leaderboardService, targetScore]);

  const selectedPath = useMemo(
    () => learningPaths.find((item) => item.id === selectedPathId) ?? null,
    [learningPaths, selectedPathId],
  );

  const recommendedPathId = useMemo(() => {
    return [...learningPaths]
      .filter((path) => path.active)
      .sort(
        (a, b) => Math.abs(a.targetScore - targetScore) - Math.abs(b.targetScore - targetScore),
      )[0]?.id;
  }, [learningPaths, targetScore]);

  const roadmapModules = roadmap?.milestones.flatMap((milestone) => milestone.modules) ?? [];
  const hasNoAssignedPath = !roadmap;
  const latestModule =
    roadmapModules.find((module) => module.moduleId === roadmap?.currentModuleId) ??
    roadmapModules.find((module) => module.progressStatus === "IN_PROGRESS") ??
    roadmapModules[0] ??
    null;
  const latestMilestone =
    roadmap?.milestones.find((milestone) =>
      milestone.modules.some((module) => module.moduleId === latestModule?.moduleId),
    ) ?? null;
  const vocabularyLearned = roadmapModules.reduce((sum, module) => sum + module.flashcardCount, 0);
  const completedModules = roadmapModules.filter((module) => module.progressStatus === "COMPLETED").length;
  const selectedTone = getPathTone(selectedPath ?? ({ targetScore } as LearningPath));

  const handleChoosePath = async () => {
    if (!auth.accessToken || !selectedPath) return;

    try {
      setAssigningPath(true);
      const response = await assignRecommendedPath(auth.accessToken, {
        learningPathId: selectedPath.id,
        targetScore: selectedPath.targetScore,
      });
      setSelectedPathId(response.data.learningPathId);
      const roadmapResponse = await getUserRoadmap(auth.accessToken);
      setRoadmap(roadmapResponse.data ?? null);
      Alert.alert("Lộ trình", `Đã chọn ${selectedPath.title}.`);
      pushRoute("/user/practice");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Không thể chọn lộ trình.";
      Alert.alert("Lỗi", message);
    } finally {
      setAssigningPath(false);
    }
  };

  return (
    <UserScreen>
      <AppHeader
        rightSlot={<AvatarBadge label={greetingName.charAt(0).toUpperCase()} />}
        subtitle="Bản đồ luyện thi hôm nay"
        title="TOEIC Trainer"
      />

      <SurfaceCard style={styles.heroCard}>
        <View style={styles.heroBackdrop} />
        <View style={styles.heroGlowLeft} />
        <View style={styles.heroGlowRight} />

        <View style={styles.heroTopRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>Xin chào, {greetingName}</Text>
            <Text style={styles.heroTitle}>Giữ nhịp học đều để kéo điểm TOEIC lên nhanh hơn.</Text>
            <Text numberOfLines={2} style={styles.heroSubtitle}>
              Tập trung vào đúng lộ trình, làm gọn từng module và giữ đà học mỗi ngày.
            </Text>
          </View>

          <View style={styles.heroTargetBadge}>
            <Text style={styles.heroTargetValue}>{targetScore}+</Text>
            <Text style={styles.heroTargetLabel}>Mục tiêu</Text>
          </View>
        </View>

        <View style={styles.heroMetaRow}>
          <View style={styles.metaChip}>
            <Ionicons color="#8EE0D3" name="flame-outline" size={14} />
            <Text style={styles.metaChipText}>{streakDays} ngày streak</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons color="#FFD18D" name="checkmark-done-outline" size={14} />
            <Text style={styles.metaChipText}>{completedModules} module xong</Text>
          </View>
          <View style={styles.metaChip}>
            <Ionicons color="#B7D7FF" name="albums-outline" size={14} />
            <Text style={styles.metaChipText}>{vocabularyLearned} từ vựng</Text>
          </View>
        </View>

        <View style={styles.progressBlock}>
          <ProgressBar
            accentColor="#F1A546"
            label="Tiến độ lộ trình"
            labelColor="#FFFFFF"
            rightLabelColor="#FFFFFF"
            rightLabel={`${Math.round(roadmap?.progressPercent ?? 0)}%`}
            value={roadmap?.progressPercent ?? 0}
          />
        </View>

        {hasNoAssignedPath ? (
          <View style={styles.noticeCard}>
            <Ionicons color="#A45C15" name="sparkles-outline" size={16} />
            <Text style={styles.noticeText}>
              Chọn một lộ trình bên dưới để hệ thống mở roadmap phù hợp cho bạn.
            </Text>
          </View>
        ) : (
          <View style={styles.liveRoadmapCard}>
            <View style={styles.liveRoadmapMain}>
              <Text style={styles.liveRoadmapCode}>{roadmap?.learningPathCode ?? "ROADMAP"}</Text>
              <Text numberOfLines={1} style={styles.liveRoadmapTitle}>
                {roadmap?.learningPathTitle ?? "Lộ trình hiện tại"}
              </Text>
              <Text numberOfLines={1} style={styles.liveRoadmapText}>
                {latestModule
                  ? `${latestModule.title} • ${latestMilestone?.title ?? "Milestone hiện tại"}`
                  : "Mở practice để tiếp tục lộ trình hôm nay."}
              </Text>
            </View>

            <View style={styles.liveRoadmapSide}>
              <Text style={styles.liveRoadmapPercent}>{Math.round(roadmap?.progressPercent ?? 0)}%</Text>
              <Text style={styles.liveRoadmapSideLabel}>Hoàn thành</Text>
            </View>
          </View>
        )}
      </SurfaceCard>

      <SectionTitle
        actionLabel={hasNoAssignedPath ? "Onboarding" : "Mở practice"}
        onActionPress={() => pushRoute(hasNoAssignedPath ? "/user/onboarding" : "/user/practice")}
        title="Chọn lộ trình học"
      />

      {loading ? (
        <View style={styles.feedbackRow}>
          <ActivityIndicator color={colors.primaryDark} />
          <Text style={styles.feedbackText}>Đang tải dữ liệu từ backend...</Text>
        </View>
      ) : null}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      {!loading ? (
        <View style={styles.pathList}>
          {learningPaths.map((path) => {
            const isSelected = selectedPathId === path.id;
            const isRecommended = recommendedPathId === path.id;
            const isCurrent = roadmap?.learningPathId === path.id;
            const tone = getPathTone(path);

            return (
              <Pressable
                key={path.id}
                onPress={() => path.active && setSelectedPathId(path.id)}
                style={[
                  styles.pathCard,
                  { backgroundColor: tone.panel, borderColor: tone.soft },
                  isSelected ? [styles.pathCardSelected, { borderColor: tone.accent }] : null,
                  !path.active ? styles.pathCardDisabled : null,
                ]}
              >
                <View style={[styles.pathOrb, { backgroundColor: tone.glow }]} />

                <View style={styles.pathHeaderRow}>
                  <View style={styles.pathTitleWrap}>
                    <Text style={styles.pathCode}>{path.code}</Text>
                    <Text numberOfLines={1} style={styles.pathTitle}>
                      {path.title}
                    </Text>
                  </View>

                  <View style={[styles.pathScoreBubble, { backgroundColor: tone.accent }]}>
                    <Text style={styles.pathScoreBubbleValue}>{path.targetScore}+</Text>
                  </View>
                </View>

                <View style={styles.pathTagRow}>
                  {isRecommended ? <Text style={[styles.pathTag, styles.pathTagAccent]}>Đề xuất</Text> : null}
                  {isCurrent ? <Text style={[styles.pathTag, styles.pathTagDark]}>Đang học</Text> : null}
                  {!path.active ? <Text style={[styles.pathTag, styles.pathTagMuted]}>Tạm khóa</Text> : null}
                </View>

                <Text numberOfLines={1} style={styles.pathDescription}>
                  {path.description}
                </Text>

                <View style={styles.pathFooter}>
                  <Text numberOfLines={1} style={styles.pathHint}>
                    {getRecommendationLabel(path, targetScore)}
                  </Text>
                  <Ionicons
                    color={tone.accent}
                    name={isSelected ? "checkmark-circle" : "arrow-forward-circle-outline"}
                    size={20}
                  />
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Pressable
        disabled={!selectedPath || assigningPath}
        onPress={handleChoosePath}
        style={[
          styles.primaryButton,
          { backgroundColor: selectedTone.accent },
          !selectedPath || assigningPath ? styles.primaryButtonDisabled : null,
        ]}
      >
        <Text style={styles.primaryButtonText}>
          {assigningPath
            ? "Đang cập nhật lộ trình..."
            : selectedPath
              ? `Bắt đầu với ${selectedPath.title}`
              : "Chọn một lộ trình"}
        </Text>
      </Pressable>

      <View style={styles.featureGrid}>
        <SurfaceCard style={styles.quickCard}>
          <View style={styles.quickCardHeader}>
            <View style={[styles.quickIconWrap, { backgroundColor: "#E7F4EF" }]}>
              <Ionicons color={colors.primary} name="library-outline" size={18} />
            </View>
            <Text style={styles.quickCardTitle}>Ngữ pháp trọng tâm</Text>
          </View>

          <Text numberOfLines={2} style={styles.quickCardText}>
            Mở nhanh thư viện ngữ pháp để ôn lại điểm quan trọng trước khi làm practice.
          </Text>

          <Pressable onPress={() => pushRoute("/user/grammar")} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Mở thư viện ngữ pháp</Text>
          </Pressable>
        </SurfaceCard>

        <SurfaceCard style={styles.leaderboardCard}>
          <View style={styles.quickCardHeader}>
            <View style={[styles.quickIconWrap, { backgroundColor: "#FCEBD7" }]}>
              <Ionicons color={colors.accent} name="trophy-outline" size={18} />
            </View>
            <Text style={styles.quickCardTitle}>Top người học tuần này</Text>
          </View>

          {leaderboard.length > 0 ? (
            <View style={styles.rankList}>
              {leaderboard.map((entry) => (
                <View key={entry.userId} style={styles.rankRow}>
                  <Text style={styles.rankIndex}>#{entry.position}</Text>
                  <View style={styles.rankAvatar}>
                    <Text style={styles.rankAvatarText}>{entry.fullName.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={styles.rankInfo}>
                    <Text numberOfLines={1} style={styles.rankName}>
                      {entry.fullName}
                    </Text>
                    <Text numberOfLines={1} style={styles.rankMeta}>
                      {entry.totalAttempts} lượt • {entry.totalScore.toFixed(1)} điểm
                    </Text>
                  </View>
                  <Text style={styles.rankBadge}>{Math.round(entry.totalScore)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.quickCardText}>Chưa có dữ liệu bảng xếp hạng từ backend.</Text>
          )}
        </SurfaceCard>
      </View>
    </UserScreen>
  );
}

const styles = StyleSheet.create({
  errorText: {
    backgroundColor: "rgba(201,87,87,0.12)",
    borderColor: "rgba(201,87,87,0.22)",
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.danger,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  featureGrid: {
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  feedbackRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  feedbackText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  heroBackdrop: {
    backgroundColor: "#143848",
    borderRadius: radius.xl,
    bottom: 0,
    left: 0,
    opacity: 0.98,
    position: "absolute",
    right: 0,
    top: 0,
  },
  heroCard: {
    backgroundColor: "#143848",
    borderColor: "#204F62",
    marginBottom: spacing.lg,
    overflow: "hidden",
    padding: spacing.md,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
    paddingRight: spacing.sm,
  },
  heroEyebrow: {
    color: "#8EE0D3",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  heroGlowLeft: {
    backgroundColor: "rgba(224,138,46,0.14)",
    borderRadius: 170,
    height: 170,
    left: -74,
    position: "absolute",
    top: 54,
    width: 170,
  },
  heroGlowRight: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 140,
    height: 140,
    position: "absolute",
    right: -30,
    top: -12,
    width: 140,
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  heroSubtitle: {
    color: "rgba(244,248,243,0.78)",
    fontSize: 12,
    lineHeight: 18,
  },
  heroTargetBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    borderWidth: 1,
    justifyContent: "center",
    minWidth: 74,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  heroTargetLabel: {
    color: "rgba(244,248,243,0.74)",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  heroTargetValue: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "900",
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 29,
    marginBottom: 6,
  },
  heroTopRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  leaderboardCard: {
    backgroundColor: "#FFF8EE",
  },
  liveRoadmapCard: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  liveRoadmapCode: {
    color: "#8EE0D3",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  liveRoadmapMain: {
    flex: 1,
    minWidth: 0,
  },
  liveRoadmapPercent: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  liveRoadmapSide: {
    alignItems: "flex-end",
    minWidth: 58,
  },
  liveRoadmapSideLabel: {
    color: "rgba(244,248,243,0.68)",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  liveRoadmapText: {
    color: "rgba(244,248,243,0.78)",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
  liveRoadmapTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    marginTop: 2,
  },
  metaChip: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  metaChipText: {
    color: "#F6F3EA",
    fontSize: 11,
    fontWeight: "800",
  },
  noticeCard: {
    alignItems: "center",
    backgroundColor: "#FFF1DE",
    borderColor: "#F1C58E",
    borderRadius: radius.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
  },
  noticeText: {
    color: "#74522F",
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
  },
  pathCard: {
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
    padding: spacing.md,
    position: "relative",
  },
  pathCardDisabled: {
    opacity: 0.55,
  },
  pathCardSelected: {
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
  },
  pathCode: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  pathDescription: {
    color: colors.text,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  pathFooter: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  pathHeaderRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  pathHint: {
    color: colors.primaryDark,
    flex: 1,
    fontSize: 12,
    fontWeight: "800",
  },
  pathList: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  pathOrb: {
    borderRadius: 90,
    height: 96,
    position: "absolute",
    right: -24,
    top: -20,
    width: 96,
  },
  pathScoreBubble: {
    alignItems: "center",
    borderRadius: radius.pill,
    justifyContent: "center",
    minWidth: 58,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  pathScoreBubbleValue: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  pathTag: {
    borderRadius: radius.pill,
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  pathTagAccent: {
    backgroundColor: "#DDF3EE",
    color: colors.primary,
  },
  pathTagDark: {
    backgroundColor: colors.primaryDark,
    color: "#FFFFFF",
  },
  pathTagMuted: {
    backgroundColor: "#E7E0D1",
    color: "#766C5C",
  },
  pathTagRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  pathTitle: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: "900",
    lineHeight: 20,
    marginTop: 2,
  },
  pathTitleWrap: {
    flex: 1,
    minWidth: 0,
  },
  primaryButton: {
    alignItems: "center",
    borderRadius: radius.pill,
    marginBottom: spacing.lg,
    paddingVertical: 13,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.surfaceDisabled,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  progressBlock: {
    marginBottom: spacing.xs,
  },
  quickCard: {
    backgroundColor: "#F8F6EF",
  },
  quickCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  quickCardText: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
  },
  quickCardTitle: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "900",
  },
  quickIconWrap: {
    alignItems: "center",
    borderRadius: radius.pill,
    height: 38,
    justifyContent: "center",
    width: 38,
  },
  rankAvatar: {
    alignItems: "center",
    backgroundColor: "#EFE3CD",
    borderRadius: radius.pill,
    height: 34,
    justifyContent: "center",
    width: 34,
  },
  rankAvatarText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900",
  },
  rankBadge: {
    color: colors.accent,
    fontSize: 13,
    fontWeight: "900",
  },
  rankIndex: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "900",
    width: 24,
  },
  rankInfo: {
    flex: 1,
    minWidth: 0,
  },
  rankList: {
    marginTop: spacing.xs,
  },
  rankMeta: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  rankName: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900",
  },
  rankRow: {
    alignItems: "center",
    borderTopColor: "#E5DCC9",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    paddingVertical: 9,
  },
  secondaryButton: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: "#E6F2EF",
    borderRadius: radius.pill,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  secondaryButtonText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "900",
  },
});
