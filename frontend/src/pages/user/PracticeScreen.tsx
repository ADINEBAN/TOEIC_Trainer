import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/src/assets/styles/user-theme";
import AppHeader, { AvatarBadge } from "@/src/components/user/AppHeader";
import ProgressBar from "@/src/components/user/ProgressBar";
import SurfaceCard from "@/src/components/user/SurfaceCard";
import UserScreen from "@/src/components/user/UserScreen";
import { useAuth } from "@/src/hooks/use-auth";
import { getUserRoadmap } from "@/src/services/user.service";
import { UserRoadmap, UserRoadmapModuleItem } from "@/src/types/user-api";
import { isNoActiveLearningPathError } from "@/src/utils/api-errors";
import { pushRoute } from "@/src/utils/navigation";

type ModuleNode = {
  ctaLabel?: string;
  isCelebration?: boolean;
  isCompleted: boolean;
  isCurrent: boolean;
  milestoneTitle: string;
  module: UserRoadmapModuleItem;
};

function statusLabel(status?: string) {
  if (status === "COMPLETED") return "Hoàn thành";
  if (status === "IN_PROGRESS") return "Đang học";
  if (status === "LOCKED") return "Đang khóa";
  return "Sẵn sàng";
}

function compactType(type?: string) {
  if (!type) return "Module";
  if (type === "VOCABULARY") return "Vocab";
  if (type === "GRAMMAR") return "Grammar";
  if (type === "MILESTONE") return "Milestone";
  return type.replaceAll("_", " ");
}

export default function PracticeScreen() {
  const { auth, isHydrated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [roadmap, setRoadmap] = useState<UserRoadmap | null>(null);

  const loadRoadmap = useCallback(async () => {
    if (!auth.accessToken) return;

    try {
      setLoading(true);
      setErrorMessage(null);
      const payload = await getUserRoadmap(auth.accessToken);
      setRoadmap(payload.data ?? null);
    } catch (error) {
      setRoadmap(null);
      if (isNoActiveLearningPathError(error)) {
        setErrorMessage(null);
        return;
      }
      setErrorMessage(error instanceof Error ? error.message : "Không thể tải roadmap practice.");
    } finally {
      setLoading(false);
    }
  }, [auth.accessToken]);

  useEffect(() => {
    if (!isHydrated || !auth.accessToken) return;
    void loadRoadmap();
  }, [auth.accessToken, isHydrated, loadRoadmap]);

  useFocusEffect(
    useCallback(() => {
      if (!isHydrated || !auth.accessToken) return;
      void loadRoadmap();
    }, [auth.accessToken, isHydrated, loadRoadmap]),
  );

  const moduleNodes = useMemo<ModuleNode[]>(() => {
    if (!roadmap) return [];

    const items = roadmap.milestones
      .flatMap((milestone) =>
        milestone.modules.map((module) => ({
          milestoneTitle: milestone.title,
          module,
        })),
      )
      .sort((a, b) => a.module.sortOrder - b.module.sortOrder)
      .map(({ milestoneTitle, module }) => ({
        isCompleted: module.progressStatus === "COMPLETED",
        isCurrent:
          module.moduleId === roadmap.currentModuleId || module.progressStatus === "IN_PROGRESS",
        milestoneTitle,
        module,
      }));

    if (roadmap.status !== "COMPLETED" || items.length === 0) return items;

    const lastSortOrder = items[items.length - 1]?.module.sortOrder ?? items.length;

    return [
      ...items,
      {
        ctaLabel: "Mở màn chúc mừng",
        isCelebration: true,
        isCompleted: true,
        isCurrent: true,
        milestoneTitle: "Hoàn tất lộ trình",
        module: {
          description: "Bạn đã hoàn thành toàn bộ roadmap. Xem lại tổng kết và màn chúc mừng cuối khóa.",
          difficultyLevel: "FINISH",
          estimatedMinutes: 3,
          flashcardCount: 0,
          moduleId: -1,
          moduleType: "MILESTONE",
          practiceSetCount: 0,
          progressPercent: 100,
          progressStatus: "COMPLETED",
          required: true,
          sortOrder: lastSortOrder + 1,
          title: "Chốt hạ mục tiêu",
          unlockCondition: "Hoàn thành toàn bộ roadmap",
          videoLessonCount: 0,
        },
      },
    ];
  }, [roadmap]);

  const realModules = moduleNodes.filter((item) => !item.isCelebration);
  const currentNode =
    moduleNodes.find((item) => item.isCurrent && !item.isCelebration) ??
    realModules[0] ??
    moduleNodes[0] ??
    null;
  const currentModule = currentNode?.module ?? null;
  const completedCount = realModules.filter((item) => item.isCompleted).length;
  const completionRatio = `${completedCount}/${realModules.length || 0}`;
  const progressPercent = Math.round(roadmap?.progressPercent ?? 0);

  const openModule = (moduleId: number) => {
    if (moduleId < 0) {
      pushRoute("/user/path-complete");
      return;
    }
    pushRoute(`/user/roadmap?moduleId=${moduleId}`);
  };

  const openCurrentPractice = () => {
    if (roadmap?.status === "COMPLETED") {
      pushRoute("/user/path-complete");
      return;
    }
    if (!currentModule) return;
    pushRoute(`/user/roadmap?moduleId=${currentModule.moduleId}&focus=practice`);
  };

  return (
    <UserScreen>
      <AppHeader
        rightSlot={<AvatarBadge label={(auth.user?.fullName ?? "A").charAt(0).toUpperCase()} />}
        subtitle="Roadmap lộ trình"
        title="TOEIC Trainer"
      />

      <SurfaceCard style={styles.heroCard}>
        <View style={styles.heroOrb} />
        <View style={styles.heroHeaderRow}>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>Lộ trình đang chọn</Text>
            <Text numberOfLines={1} style={styles.title}>
              {roadmap?.learningPathTitle ?? "Chưa chọn lộ trình học"}
            </Text>
          </View>
          <View style={styles.heroScorePill}>
            <Text style={styles.heroScoreValue}>{roadmap?.targetScore ?? auth.user?.targetScore ?? "--"}+</Text>
          </View>
        </View>

        <Text style={styles.subtitle}>
          {roadmap?.status === "COMPLETED"
            ? "Lộ trình này đã hoàn thành. Bạn vẫn có thể xem lại đầy đủ module và mở màn chúc mừng cuối khóa."
            : "Theo dõi module hiện tại, làm practice đúng thứ tự và giữ tiến độ học mỗi ngày."}
        </Text>

        <View style={styles.currentPathBlock}>
          <View style={styles.currentPathTopRow}>
            <Text style={styles.currentPathLabel}>{roadmap?.learningPathCode ?? "ROADMAP"}</Text>
            <Text numberOfLines={1} style={styles.currentPathMeta}>
              {currentNode?.milestoneTitle ?? "Chưa có chặng"}
            </Text>
          </View>
          <Text numberOfLines={1} style={styles.currentPathTitle}>
            {currentModule?.title ?? "Chưa có module hiện tại"}
          </Text>
        </View>

        <View style={styles.summaryGrid}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryValue}>{completionRatio}</Text>
            <Text style={styles.summaryLabel}>Đã xong</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text numberOfLines={1} style={styles.summaryValueCompact}>
              {statusLabel(roadmap?.status)}
            </Text>
            <Text style={styles.summaryLabel}>Trạng thái</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text numberOfLines={1} style={styles.summaryValueCompact}>
              {compactType(currentModule?.moduleType)}
            </Text>
            <Text style={styles.summaryLabel}>Loại</Text>
          </View>
        </View>

        <ProgressBar
          accentColor="#F0A33A"
          label="Tiến độ toàn lộ trình"
          rightLabel={`${progressPercent}%`}
          value={progressPercent}
        />
      </SurfaceCard>

      <Pressable
        disabled={!currentModule}
        onPress={openCurrentPractice}
        style={[styles.primaryButton, !currentModule ? styles.primaryButtonDisabled : null]}
      >
        <Ionicons color={colors.surface} name="play-circle-outline" size={17} />
        <Text style={styles.primaryButtonText}>
          {roadmap?.status === "COMPLETED" ? "Xem màn chúc mừng" : "Tiếp tục module hiện tại"}
        </Text>
      </Pressable>

      {loading ? (
        <View style={styles.feedbackRow}>
          <ActivityIndicator color={colors.primaryDark} />
          <Text style={styles.feedbackText}>Đang đồng bộ roadmap từ backend...</Text>
        </View>
      ) : null}

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      {!loading && !errorMessage && !roadmap ? (
        <SurfaceCard style={styles.emptyStateCard}>
          <Text style={styles.emptyStateTitle}>Bạn chưa có roadmap nào</Text>
          <Text style={styles.emptyText}>Tài khoản mới cần chọn lộ trình trước khi vào practice.</Text>
          <Pressable onPress={() => pushRoute("/user/onboarding")} style={styles.secondaryCta}>
            <Text style={styles.secondaryCtaText}>Bắt đầu onboarding</Text>
          </Pressable>
        </SurfaceCard>
      ) : null}

      {!loading && !errorMessage && roadmap && moduleNodes.length === 0 ? (
        <SurfaceCard>
          <Text style={styles.emptyText}>Chưa có module nào trong lộ trình hiện tại.</Text>
        </SurfaceCard>
      ) : null}

      <View style={styles.treeWrap}>
        <View style={styles.centerLine} />
        {moduleNodes.map((item, index) => {
          const alignRight = index % 2 === 1;
          const isCurrent = item.isCurrent;
          const isDone = item.isCompleted;

          return (
            <View
              key={item.module.moduleId}
              style={[styles.branchRow, alignRight ? styles.branchRowRight : styles.branchRowLeft]}
            >
              <View style={[styles.connector, alignRight ? styles.connectorRight : styles.connectorLeft]} />

              <View style={[styles.nodeWrap, alignRight ? styles.nodeWrapRight : styles.nodeWrapLeft]}>
                <View
                  style={[
                    styles.nodeBadge,
                    isDone ? styles.nodeBadgeDone : null,
                    isCurrent ? styles.nodeBadgeCurrent : null,
                    item.isCelebration ? styles.nodeBadgeCelebration : null,
                  ]}
                >
                  <Ionicons
                    color={isDone || isCurrent ? colors.surface : colors.primaryDark}
                    name={
                      item.isCelebration
                        ? "trophy-outline"
                        : isDone
                          ? "checkmark-outline"
                          : isCurrent
                            ? "sparkles-outline"
                            : "book-outline"
                    }
                    size={17}
                  />
                </View>

                <Pressable
                  onPress={() => openModule(item.module.moduleId)}
                  style={[styles.roadmapCard, item.isCelebration ? styles.roadmapCardCelebration : null]}
                >
                  <View style={styles.cardHeader}>
                    <Text style={styles.moduleStep}>
                      {item.isCelebration ? "Chặng cuối đã mở" : `Module ${index + 1}`}
                    </Text>
                    {isDone ? <Text style={styles.doneTag}>Hoàn thành</Text> : null}
                    {isCurrent && !isDone ? <Text style={styles.currentTag}>Đang học</Text> : null}
                  </View>
                  <Text style={styles.moduleTitle}>{item.module.title}</Text>
                  <Text numberOfLines={2} style={styles.moduleDescription}>
                    {item.module.description ?? `Milestone: ${item.milestoneTitle}`}
                  </Text>
                  {item.isCelebration ? (
                    <Text style={styles.celebrationMeta}>
                      Bấm để xem màn hoàn thành khóa học và tổng kết hành trình của bạn.
                    </Text>
                  ) : (
                    <View style={styles.moduleMetaRow}>
                      <Text style={styles.moduleMeta}>{item.module.videoLessonCount} video</Text>
                      <Text style={styles.moduleMeta}>{item.module.flashcardCount} vocab</Text>
                      <Text style={styles.moduleMeta}>{item.module.practiceSetCount} practice</Text>
                    </View>
                  )}
                  <ProgressBar
                    accentColor={item.isCelebration ? "#F0A33A" : isDone ? colors.success : colors.primary}
                    rightLabel={`${Math.round(item.module.progressPercent)}%`}
                    value={item.module.progressPercent}
                  />
                  {item.ctaLabel ? <Text style={styles.celebrationCta}>{item.ctaLabel}</Text> : null}
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    </UserScreen>
  );
}

const styles = StyleSheet.create({
  branchRow: {
    marginBottom: spacing.lg,
    minHeight: 178,
    position: "relative",
    width: "100%",
  },
  branchRowLeft: {
    alignItems: "flex-start",
  },
  branchRowRight: {
    alignItems: "flex-end",
  },
  cardHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  celebrationCta: {
    color: "#A25B00",
    fontSize: 12,
    fontWeight: "900",
    marginTop: spacing.xs,
  },
  celebrationMeta: {
    color: "#6B4A17",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.xs,
  },
  centerLine: {
    backgroundColor: "#C7BFAE",
    bottom: 0,
    left: "50%",
    marginLeft: -1,
    position: "absolute",
    top: 8,
    width: 2,
  },
  connector: {
    borderColor: "#C7BFAE",
    borderTopWidth: 2,
    height: 54,
    position: "absolute",
    top: 20,
    width: 42,
  },
  connectorLeft: {
    borderLeftWidth: 2,
    borderTopLeftRadius: 26,
    left: "50%",
  },
  connectorRight: {
    borderRightWidth: 2,
    borderTopRightRadius: 26,
    right: "50%",
  },
  currentPathBlock: {
    backgroundColor: "rgba(255,255,255,0.75)",
    borderColor: "#E1D4B8",
    borderRadius: radius.lg,
    borderWidth: 1,
    marginBottom: spacing.md,
    padding: spacing.md,
  },
  currentPathLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  currentPathMeta: {
    color: colors.textMuted,
    flex: 1,
    fontSize: 12,
    textAlign: "right",
  },
  currentPathTitle: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 8,
  },
  currentPathTopRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
  },
  currentTag: {
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    color: colors.surface,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  doneTag: {
    backgroundColor: "#D7F5E3",
    borderRadius: radius.pill,
    color: colors.success,
    fontSize: 11,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  emptyStateCard: {
    marginBottom: spacing.md,
  },
  emptyStateTitle: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: spacing.xs,
    textAlign: "center",
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
  },
  errorText: {
    backgroundColor: "rgba(201,87,87,0.1)",
    borderColor: "rgba(201,87,87,0.24)",
    borderRadius: radius.md,
    borderWidth: 1,
    color: colors.danger,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
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
  heroCard: {
    backgroundColor: "#F1F8FB",
    borderColor: "#D7DCCE",
    marginBottom: spacing.md,
    overflow: "hidden",
    padding: spacing.lg,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroEyebrow: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  heroHeaderRow: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  heroOrb: {
    backgroundColor: "rgba(15,107,98,0.08)",
    borderRadius: 120,
    height: 140,
    position: "absolute",
    right: -34,
    top: -24,
    width: 140,
  },
  heroScorePill: {
    alignItems: "center",
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    justifyContent: "center",
    minWidth: 84,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  heroScoreValue: {
    color: colors.surface,
    fontSize: 22,
    fontWeight: "900",
  },
  moduleDescription: {
    color: colors.text,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: spacing.sm,
  },
  moduleMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "800",
  },
  moduleMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  moduleStep: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  moduleTitle: {
    color: colors.primaryDark,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: spacing.xs,
  },
  nodeBadge: {
    alignItems: "center",
    backgroundColor: colors.surfaceAlt,
    borderColor: colors.borderStrong,
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 38,
    justifyContent: "center",
    left: -19,
    position: "absolute",
    top: 20,
    width: 38,
    zIndex: 2,
  },
  nodeBadgeCelebration: {
    backgroundColor: "#F0A33A",
    borderColor: "#F0A33A",
  },
  nodeBadgeCurrent: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  nodeBadgeDone: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  nodeWrap: {
    position: "relative",
    width: "47%",
  },
  nodeWrapLeft: {
    marginRight: "53%",
  },
  nodeWrapRight: {
    marginLeft: "53%",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    marginBottom: spacing.lg,
    paddingVertical: 16,
  },
  primaryButtonDisabled: {
    backgroundColor: colors.surfaceDisabled,
  },
  primaryButtonText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: "900",
  },
  roadmapCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radius.xl,
    borderWidth: 1,
    minHeight: 152,
    padding: spacing.md,
  },
  roadmapCardCelebration: {
    backgroundColor: "#FFF8E8",
    borderColor: "#F6D38C",
  },
  secondaryCta: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.pill,
    marginTop: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 12,
  },
  secondaryCtaText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900",
  },
  subtitle: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 23,
    marginBottom: spacing.lg,
  },
  summaryCard: {
    backgroundColor: "rgba(255,255,255,0.75)",
    borderRadius: radius.xl,
    flex: 1,
    minHeight: 88,
    minWidth: 0,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  summaryGrid: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 6,
  },
  summaryValue: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: "900",
  },
  summaryValueCompact: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    color: colors.primaryDark,
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 32,
  },
  treeWrap: {
    paddingBottom: spacing.xl,
    position: "relative",
  },
});
