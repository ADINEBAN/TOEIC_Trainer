import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/src/assets/styles/user-theme";
import AppHeader from "@/src/components/user/AppHeader";
import ProgressBar from "@/src/components/user/ProgressBar";
import SurfaceCard from "@/src/components/user/SurfaceCard";
import UserScreen from "@/src/components/user/UserScreen";
import { useAuth } from "@/src/hooks/use-auth";
import { getUserLessons, updateLessonProgress } from "@/src/services/user.service";
import { UserLessonApiItem } from "@/src/types/user-api";
import { pushRoute } from "@/src/utils/navigation";

function NativeLessonVideo({
  durationSeconds,
  onProgress,
  url,
}: {
  durationSeconds: number;
  onProgress: (seconds: number, duration: number) => void;
  url: string;
}) {
  const player = useVideoPlayer(url, (instance) => {
    instance.timeUpdateEventInterval = 1;
  });

  useEffect(() => {
    const subscription = player.addListener("timeUpdate", ({ currentTime }) => {
      const duration = player.duration > 0 ? player.duration : durationSeconds;
      onProgress(currentTime, duration);
    });
    return () => subscription.remove();
  }, [player, onProgress, durationSeconds]);

  return <VideoView player={player} style={styles.nativeVideo} nativeControls contentFit="contain" />;
}

export default function LessonScreen() {
  const { auth, isHydrated } = useAuth();
  const params = useLocalSearchParams<{ moduleId?: string }>();

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lessons, setLessons] = useState<UserLessonApiItem[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [updatingProgress, setUpdatingProgress] = useState(false);
  const lastSyncedSecondRef = useRef(0);

  const selectedModuleId = useMemo(() => {
    if (!params.moduleId) return undefined;
    const parsed = Number(params.moduleId);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [params.moduleId]);

  const loadLessons = useCallback(async () => {
    if (!auth.accessToken) return;
    try {
      setLoading(true);
      setErrorMessage(null);
      const payload = await getUserLessons(auth.accessToken, selectedModuleId);
      const records = payload.data ?? [];
      setLessons(records);
      setSelectedLessonId((current) => {
        if (current && records.some((item) => item.lessonId === current)) return current;
        return records.find((item) => item.progressStatus === "IN_PROGRESS")?.lessonId ?? records[0]?.lessonId ?? null;
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Không thể tải danh sách bài học.");
      setLessons([]);
      setSelectedLessonId(null);
    } finally {
      setLoading(false);
    }
  }, [auth.accessToken, selectedModuleId]);

  useEffect(() => {
    if (!isHydrated || !auth.accessToken) return;
    void loadLessons();
  }, [auth.accessToken, isHydrated, loadLessons]);

  const currentLesson = lessons.find((item) => item.lessonId === selectedLessonId) ?? lessons[0] ?? null;
  const completionValue = Math.max(0, Math.min(100, Math.round(currentLesson?.completionPercent ?? 0)));
  const allLessonsCompleted = lessons.length > 0 && lessons.every((lesson) => lesson.progressStatus === "COMPLETED");

  const formatDuration = (seconds: number) => `${Math.max(1, Math.round(seconds / 60))} phút`;
  const formatStatus = (status: string) => {
    if (status === "COMPLETED") return "Hoàn thành";
    if (status === "IN_PROGRESS") return "Đang học";
    return "Chưa học";
  };

  const openVideoUrl = async () => {
    if (!currentLesson?.videoUrl) return;
    try {
      await WebBrowser.openBrowserAsync(currentLesson.videoUrl);
    } catch (error) {
      Alert.alert("Video", error instanceof Error ? error.message : "Không mở được video.");
    }
  };

  const handleResumeLesson = async () => {
    if (!auth.accessToken || !currentLesson || updatingProgress) return;
    try {
      setUpdatingProgress(true);
      const nextPosition = Math.min(currentLesson.durationSeconds, Math.max(0, currentLesson.lastPositionSeconds) + 60);
      const nextCompletion = Math.min(99, Math.max(currentLesson.completionPercent, (nextPosition / currentLesson.durationSeconds) * 100));
      await updateLessonProgress(auth.accessToken, currentLesson.lessonId, {
        completionPercent: nextCompletion,
        lastPositionSeconds: nextPosition,
        status: "IN_PROGRESS",
        watchedSeconds: nextPosition,
      });
      await loadLessons();
    } catch (error) {
      Alert.alert("Lesson", error instanceof Error ? error.message : "Không cập nhật được tiến độ.");
    } finally {
      setUpdatingProgress(false);
    }
  };

  const syncPlaybackProgress = useCallback(async (seconds: number, duration: number) => {
    if (!auth.accessToken || !currentLesson || updatingProgress) return;
    if (!Number.isFinite(seconds) || !Number.isFinite(duration) || duration <= 0) return;

    const normalizedSeconds = Math.min(duration, Math.max(0, Math.floor(seconds)));
    const normalizedPercent = Math.min(100, Math.max(0, (normalizedSeconds / duration) * 100));
    const shouldComplete = normalizedPercent >= 90;
    const shouldSyncByTick = normalizedSeconds - lastSyncedSecondRef.current >= 20;
    const shouldSyncByComplete = shouldComplete && currentLesson.progressStatus !== "COMPLETED";

    if (!shouldSyncByTick && !shouldSyncByComplete) return;

    lastSyncedSecondRef.current = normalizedSeconds;
    try {
      await updateLessonProgress(auth.accessToken, currentLesson.lessonId, {
        completionPercent: shouldComplete ? 100 : normalizedPercent,
        lastPositionSeconds: normalizedSeconds,
        status: shouldComplete ? "COMPLETED" : "IN_PROGRESS",
        watchedSeconds: normalizedSeconds,
      });
    } catch (error) {
      console.log("[lesson] sync progress error", error);
    }
  }, [auth.accessToken, currentLesson, updatingProgress]);

  const handleCompleteVideosAndGoCards = async () => {
    if (!currentLesson?.moduleId) return;
    await loadLessons();
    pushRoute(`/user/cards?moduleId=${currentLesson.moduleId}`);
  };

  const renderVideoPlayer = () => {
    if (!currentLesson?.videoUrl) {
      return <Text style={styles.placeholderText}>Bài học này chưa có video.</Text>;
    }

    if (Platform.OS === "web") {
      return React.createElement("video", {
        controls: true,
        src: currentLesson.videoUrl,
        style: styles.webVideo as unknown as object,
        onTimeUpdate: (event: any) => {
          const current = Number(event?.currentTarget?.currentTime ?? 0);
          const duration = Number(event?.currentTarget?.duration ?? currentLesson.durationSeconds);
          void syncPlaybackProgress(current, duration);
        },
      });
    }

    return (
      <NativeLessonVideo
        key={currentLesson.lessonId}
        url={currentLesson.videoUrl}
        durationSeconds={currentLesson.durationSeconds}
        onProgress={(seconds, duration) => {
          void syncPlaybackProgress(seconds, duration);
        }}
      />
    );
  };

  return (
    <UserScreen>
      <AppHeader
        title={currentLesson?.lessonTitle ?? "Thư viện bài học"}
        leftIcon="chevron-back-outline"
        onLeftPress={() => router.back()}
        rightSlot={<Ionicons color={colors.primaryDark} name="person-circle" size={42} />}
      />

      <SurfaceCard style={styles.playerCard}>
        <View style={styles.videoFrame}>{renderVideoPlayer()}</View>
        <View style={styles.metaHeader}>
          <Text style={styles.moduleMeta}>
            {currentLesson?.moduleTitle ?? "Chưa có module"} | {currentLesson ? formatDuration(currentLesson.durationSeconds) : "--"}
          </Text>
          <Text style={styles.percentMeta}>{completionValue}%</Text>
        </View>
        <ProgressBar accentColor="#2E8B57" value={completionValue} />
        <Text style={styles.descriptionText}>{currentLesson?.lessonDescription ?? "Chưa có mô tả bài học."}</Text>

        <View style={styles.actionRow}>
          <Pressable style={styles.secondaryBtn} onPress={openVideoUrl}>
            <Ionicons name="open-outline" size={16} color="#173267" />
            <Text style={styles.secondaryBtnText}>Mở link</Text>
          </Pressable>
          <Pressable style={styles.primaryBtn} onPress={handleResumeLesson} disabled={updatingProgress}>
            <Ionicons name="play" size={16} color="#fff" />
            <Text style={styles.primaryBtnText}>Tiếp tục</Text>
          </Pressable>
        </View>
      </SurfaceCard>

      {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

      <Text style={styles.sectionTitle}>Danh sách bài học</Text>
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={colors.primaryDark} />
          <Text style={styles.loadingText}>Đang tải bài học...</Text>
        </View>
      ) : null}

      {!loading && lessons.length === 0 ? <Text style={styles.emptyText}>Chưa có bài học nào.</Text> : null}
      {!loading &&
        lessons.map((lesson) => {
          const active = lesson.lessonId === currentLesson?.lessonId;
          return (
            <Pressable
              key={lesson.lessonId}
              style={[styles.lessonRow, active ? styles.lessonRowActive : null]}
              onPress={() => setSelectedLessonId(lesson.lessonId)}
            >
              <View style={styles.orderTag}>
                <Text style={styles.orderTagText}>#{lesson.sortOrder}</Text>
              </View>
              <View style={styles.lessonInfo}>
                <Text style={styles.lessonTitle}>{lesson.lessonTitle}</Text>
                <Text style={styles.lessonSub}>{formatStatus(lesson.progressStatus)} | {formatDuration(lesson.durationSeconds)}</Text>
              </View>
            </Pressable>
          );
        })}

      {allLessonsCompleted ? (
        <Pressable
          style={[styles.completeBtn, updatingProgress ? styles.completeBtnDisabled : null]}
          disabled={!currentLesson || updatingProgress}
          onPress={handleCompleteVideosAndGoCards}
        >
          <Text style={styles.completeBtnText}>Đã xong video, sang luyện từ vựng</Text>
        </Pressable>
      ) : (
        <Text style={styles.videoRequirementText}>
          Xem tất cả video trong module ({"\u2265"}90%) để mở bước từ vựng.
        </Text>
      )}
    </UserScreen>
  );
}

const styles = StyleSheet.create({
  playerCard: {
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  videoFrame: {
    backgroundColor: "#0B1220",
    borderRadius: 14,
    minHeight: 220,
    overflow: "hidden",
  },
  webVideo: {
    backgroundColor: "#000",
    height: 220,
    width: "100%",
  },
  nativeVideo: {
    backgroundColor: "#000",
    height: 220,
    width: "100%",
  },
  placeholderWrap: {
    alignItems: "center",
    height: 220,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  placeholderText: {
    color: "#C8D2E8",
    fontSize: 14,
    textAlign: "center",
  },
  metaHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: spacing.md,
  },
  moduleMeta: {
    color: "#173267",
    fontSize: 12,
    fontWeight: "700",
  },
  percentMeta: {
    color: "#1F4FBF",
    fontSize: 13,
    fontWeight: "800",
  },
  descriptionText: {
    color: "#35507F",
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  primaryBtn: {
    alignItems: "center",
    backgroundColor: "#1F4FBF",
    borderRadius: radius.pill,
    flex: 1,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 42,
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
  },
  secondaryBtn: {
    alignItems: "center",
    backgroundColor: "#ECF1FD",
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 42,
    paddingHorizontal: spacing.md,
  },
  secondaryBtnText: {
    color: "#173267",
    fontSize: 12,
    fontWeight: "800",
  },
  sectionTitle: {
    color: "#173267",
    fontSize: 18,
    fontWeight: "900",
    marginBottom: spacing.md,
  },
  warningText: {
    color: "#805B00",
    fontSize: 12,
    marginBottom: spacing.md,
  },
  errorText: {
    backgroundColor: "rgba(249,112,102,0.1)",
    borderColor: "rgba(249,112,102,0.24)",
    borderRadius: 8,
    borderWidth: 1,
    color: colors.danger,
    fontSize: 13,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  loadingWrap: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 13,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  lessonRow: {
    alignItems: "center",
    backgroundColor: "#F7F9FF",
    borderRadius: 12,
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
    padding: spacing.sm,
  },
  lessonRowActive: {
    backgroundColor: "#E7EEFF",
    borderColor: "#C7D7FF",
    borderWidth: 1,
  },
  orderTag: {
    backgroundColor: "#DCE6FF",
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
  },
  orderTagText: {
    color: "#173267",
    fontSize: 12,
    fontWeight: "900",
  },
  lessonInfo: {
    flex: 1,
  },
  lessonTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
  },
  lessonSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  completeBtn: {
    alignItems: "center",
    backgroundColor: "#2E8B57",
    borderRadius: radius.pill,
    marginBottom: spacing.md,
    marginTop: spacing.md,
    minHeight: 44,
    justifyContent: "center",
  },
  completeBtnDisabled: {
    opacity: 0.7,
  },
  completeBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "900",
  },
  videoRequirementText: {
    color: colors.textMuted,
    fontSize: 12,
    marginBottom: spacing.md,
    marginTop: spacing.md,
    textAlign: "center",
  },
});
