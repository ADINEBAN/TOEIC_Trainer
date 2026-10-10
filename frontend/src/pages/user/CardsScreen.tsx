import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import * as Speech from "expo-speech";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { colors, radius, spacing } from "@/src/assets/styles/user-theme";
import AppHeader, { AvatarBadge } from "@/src/components/user/AppHeader";
import ProgressBar from "@/src/components/user/ProgressBar";
import SurfaceCard from "@/src/components/user/SurfaceCard";
import UserScreen from "@/src/components/user/UserScreen";
import { useAuth } from "@/src/hooks/use-auth";
import {
  createFlashcardCollection,
  createMyFlashcard,
  deleteFlashcardCollection,
  deleteMyFlashcard,
  getFlashcardCollectionDetail,
  getModuleFlashcardsForUser,
  getMyFlashcardCollections,
  getMyFlashcards,
  updateMyFlashcard,
} from "@/src/services/user.service";
import {
  getSpeechifyApiKey,
  speakTextWithSpeechify,
  type PronunciationOptions,
} from "@/src/services/speechify-tts.service";
import { vocabProgressStore } from "@/src/store/progress-store";
import { FlashcardApiItem, FlashcardCollectionApiItem } from "@/src/types/user-api";
import { replaceRoute } from "@/src/utils/navigation";

type TabMode = "lesson" | "mine";
type AddMode = "manual" | "bulk";

type BulkFlashcardInput = {
  englishWord: string;
  meaningVi: string;
  exampleSentence?: string;
  pronunciation?: string;
};

const QUICK_JSON_TEMPLATE = `{
  "topicName": "Business Meeting",
  "topicDescription": "Từ vựng họp và đàm phán",
  "items": [
    {
      "englishWord": "negotiate",
      "meaningVi": "đàm phán",
      "exampleSentence": "We need to negotiate a better price.",
      "pronunciation": "/nɪˈɡəʊ.ʃi.eɪt/"
    }
  ]
}`;

function formatName(fullName?: string | null) {
  if (!fullName?.trim()) return "B";
  return fullName.trim().charAt(0).toUpperCase();
}

export default function CardsScreen() {
  const { auth } = useAuth();
  const params = useLocalSearchParams<{ moduleId?: string }>();

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [mode, setMode] = useState<TabMode>("mine");
  const [showMeaning, setShowMeaning] = useState(false);
  const [cardIndex, setCardIndex] = useState(0);

  const [lessonCards, setLessonCards] = useState<FlashcardApiItem[]>([]);
  const [myCards, setMyCards] = useState<FlashcardApiItem[]>([]);
  const [collections, setCollections] = useState<FlashcardCollectionApiItem[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<number | null>(null);

  const [voiceRegion, setVoiceRegion] = useState<"US" | "UK">("US");
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [speechifyConfigured, setSpeechifyConfigured] = useState(false);

  const [showTopicEditor, setShowTopicEditor] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("manual");

  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDescription, setNewCollectionDescription] = useState("");

  const [manualWord, setManualWord] = useState("");
  const [manualMeaning, setManualMeaning] = useState("");
  const [manualExample, setManualExample] = useState("");
  const [manualPronunciation, setManualPronunciation] = useState("");
  const [bulkJson, setBulkJson] = useState(QUICK_JSON_TEMPLATE);

  const selectedModuleId = useMemo(() => {
    if (!params.moduleId) return undefined;
    const parsed = Number(params.moduleId);
    return Number.isFinite(parsed) ? parsed : undefined;
  }, [params.moduleId]);

  const currentCards = mode === "lesson" ? lessonCards : myCards;
  const currentCard = useMemo(() => {
    if (currentCards.length === 0) return null;
    return currentCards[cardIndex % currentCards.length];
  }, [cardIndex, currentCards]);

  const currentCollection = useMemo(
    () => collections.find((collection) => collection.id === selectedCollectionId) ?? null,
    [collections, selectedCollectionId],
  );

  const progressValue = currentCards.length ? ((cardIndex + 1) / currentCards.length) * 100 : 0;
  const avatarLabel = formatName(auth.user?.fullName);

  const loadCollectionsAndCards = useCallback(async () => {
    if (!auth.accessToken) return;
    const collectionsPayload = await getMyFlashcardCollections(auth.accessToken);
    const nextCollections = collectionsPayload.data ?? [];
    setCollections(nextCollections);
    const nextSelected =
      selectedCollectionId && nextCollections.some((item) => item.id === selectedCollectionId)
        ? selectedCollectionId
        : nextCollections[0]?.id ?? null;
    setSelectedCollectionId(nextSelected);

    if (nextSelected) {
      const detail = await getFlashcardCollectionDetail(auth.accessToken, nextSelected);
      setMyCards(detail.data?.flashcards ?? []);
      return;
    }

    const mine = await getMyFlashcards(auth.accessToken);
    setMyCards(mine.data ?? []);
  }, [auth.accessToken, selectedCollectionId]);

  const loadAll = useCallback(async () => {
    if (!auth.accessToken) return;

    try {
      setLoading(true);
      if (selectedModuleId) {
        const moduleCards = await getModuleFlashcardsForUser(auth.accessToken, selectedModuleId);
        setLessonCards(moduleCards.data ?? []);
        setMode("lesson");
      } else {
        setLessonCards([]);
        setMode("mine");
      }

      await loadCollectionsAndCards();
      setCardIndex(0);
      setShowMeaning(false);
    } catch (error) {
      Alert.alert("Flashcards", error instanceof Error ? error.message : "Không thể tải flashcard.");
    } finally {
      setLoading(false);
    }
  }, [auth.accessToken, loadCollectionsAndCards, selectedModuleId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    void getSpeechifyApiKey().then((key) => setSpeechifyConfigured(Boolean(key)));
  }, []);

  const speakWithDeviceVoice = (text: string, options: PronunciationOptions) => {
    if (!text.trim()) return;

    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      void (async () => {
        try {
          await Speech.stop().catch(() => undefined);
          Speech.speak(text, {
            language: voiceRegion === "US" ? "en-US" : "en-GB",
            onDone: options.onDone,
            onError: options.onError,
            onStart: options.onStart,
            onStopped: options.onDone,
            pitch: options.pitch ?? pitch,
            rate: options.rate ?? rate,
          });
        } catch (error) {
          options.onError?.(error instanceof Error ? error : new Error("Không phát được giọng máy."));
        }
      })();
      return;
    }

    const synth = window.speechSynthesis;
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = synth.getVoices();
    const preferredLocale = voiceRegion === "US" ? "en-us" : "en-gb";
    const selectedVoice =
      voices.find((voice) => voice.lang.toLowerCase() === preferredLocale) ??
      voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ??
      null;

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang;
    } else {
      utterance.lang = preferredLocale;
    }

    utterance.rate = options.rate ?? rate;
    utterance.pitch = options.pitch ?? pitch;
    utterance.onend = () => options.onDone?.();
    utterance.onerror = () => options.onError?.(new Error("Không phát được giọng máy."));
    synth.cancel();
    options.onStart?.();
    synth.speak(utterance);
  };

  const speakText = (text: string) => {
    if (!text.trim()) return;

    setIsGeneratingSpeech(false);
    setIsSpeaking(false);
    void (async () => {
      try {
        const source = await speakTextWithSpeechify(text, {
          fallbackSpeak: speakWithDeviceVoice,
          language: voiceRegion === "US" ? "en-US" : "en-GB",
          onDone: () => {
            setIsGeneratingSpeech(false);
            setIsSpeaking(false);
          },
          onError: () => {
            setIsGeneratingSpeech(false);
            setIsSpeaking(false);
          },
          onGenerating: () => {
            setSpeechifyConfigured(true);
            setIsGeneratingSpeech(true);
            setIsSpeaking(false);
          },
          onStart: () => {
            setIsGeneratingSpeech(false);
            setIsSpeaking(true);
          },
          pitch,
          rate,
        });

        if (source === "speechify") {
          setSpeechifyConfigured(true);
        } else {
          setSpeechifyConfigured(Boolean(await getSpeechifyApiKey()));
        }
      } catch {
        setIsGeneratingSpeech(false);
        setIsSpeaking(false);
      }
    })();
  };

  const createAndAttachToCollection = async (item: BulkFlashcardInput, collectionId: number | null) => {
    if (!auth.accessToken) return;

    const created = await createMyFlashcard(auth.accessToken, {
      englishWord: item.englishWord.trim(),
      meaningVi: item.meaningVi.trim(),
      exampleSentence: item.exampleSentence?.trim() || undefined,
      pronunciation: item.pronunciation?.trim() || undefined,
    });

    if (collectionId && created.data?.id) {
      await updateMyFlashcard(auth.accessToken, created.data.id, {
        flashcardCollectionId: collectionId,
      });
    }
  };

  const handleCreateCollection = async () => {
    if (!auth.accessToken || !newCollectionName.trim()) {
      Alert.alert("Chủ đề", "Nhập tên chủ đề trước.");
      return;
    }

    try {
      setWorking(true);
      const created = await createFlashcardCollection(auth.accessToken, {
        name: newCollectionName.trim(),
        description: newCollectionDescription.trim() || undefined,
      });
      setNewCollectionName("");
      setNewCollectionDescription("");
      setSelectedCollectionId(created.data?.id ?? null);
      await loadCollectionsAndCards();
      setShowTopicEditor(false);
    } catch (error) {
      Alert.alert("Chủ đề", error instanceof Error ? error.message : "Không tạo được chủ đề.");
    } finally {
      setWorking(false);
    }
  };

  const handleDeleteCollection = async () => {
    if (!auth.accessToken || !selectedCollectionId) return;

    try {
      setWorking(true);
      await deleteFlashcardCollection(auth.accessToken, selectedCollectionId);
      setSelectedCollectionId(null);
      await loadCollectionsAndCards();
    } catch (error) {
      Alert.alert("Chủ đề", error instanceof Error ? error.message : "Không xóa được chủ đề.");
    } finally {
      setWorking(false);
    }
  };

  const handleManualAdd = async () => {
    if (!manualWord.trim() || !manualMeaning.trim()) {
      Alert.alert("Flashcard", "Cần nhập từ tiếng Anh và nghĩa tiếng Việt.");
      return;
    }

    try {
      setWorking(true);
      await createAndAttachToCollection(
        {
          englishWord: manualWord,
          meaningVi: manualMeaning,
          exampleSentence: manualExample,
          pronunciation: manualPronunciation,
        },
        selectedCollectionId,
      );
      setManualWord("");
      setManualMeaning("");
      setManualExample("");
      setManualPronunciation("");
      await loadCollectionsAndCards();
      setShowAddForm(false);
    } catch (error) {
      Alert.alert("Flashcard", error instanceof Error ? error.message : "Không thêm được flashcard.");
    } finally {
      setWorking(false);
    }
  };

  const parseBulkInput = (raw: string): { topicName?: string; topicDescription?: string; items: BulkFlashcardInput[] } => {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return { items: parsed as BulkFlashcardInput[] };

    if (typeof parsed === "object" && parsed !== null && "items" in parsed) {
      const data = parsed as {
        topicName?: string;
        topic?: string;
        topicDescription?: string;
        description?: string;
        items: BulkFlashcardInput[];
      };

      return {
        topicDescription: data.topicDescription ?? data.description,
        topicName: data.topicName ?? data.topic,
        items: Array.isArray(data.items) ? data.items : [],
      };
    }

    return { items: [] };
  };

  const handleBulkAdd = async () => {
    if (!auth.accessToken) return;

    try {
      setWorking(true);
      const payload = parseBulkInput(bulkJson);
      if (!payload.items.length) throw new Error("JSON không hợp lệ hoặc không có items.");

      let collectionId = selectedCollectionId;

      if (!collectionId && payload.topicName?.trim()) {
        const created = await createFlashcardCollection(auth.accessToken, {
          name: payload.topicName.trim(),
          description: payload.topicDescription?.trim() || undefined,
        });
        collectionId = created.data?.id ?? null;
      }

      for (const item of payload.items) {
        if (!item.englishWord?.trim() || !item.meaningVi?.trim()) continue;
        await createAndAttachToCollection(item, collectionId);
      }

      await loadCollectionsAndCards();
      setShowAddForm(false);
      Alert.alert("Flashcard", "Đã thêm nhanh từ JSON.");
    } catch (error) {
      Alert.alert("Bulk JSON", error instanceof Error ? error.message : "Không parse được JSON.");
    } finally {
      setWorking(false);
    }
  };

  const handleDeleteCurrentCard = async () => {
    if (!auth.accessToken || !currentCard || mode !== "mine") return;

    try {
      setWorking(true);
      await deleteMyFlashcard(auth.accessToken, currentCard.id);
      await loadCollectionsAndCards();
      setCardIndex(0);
      setShowMeaning(false);
    } catch (error) {
      Alert.alert("Flashcard", error instanceof Error ? error.message : "Không xóa được từ.");
    } finally {
      setWorking(false);
    }
  };

  const handleFinishLessonCards = () => {
    if (!selectedModuleId) return;
    vocabProgressStore.markCompleted(selectedModuleId);
    replaceRoute(`/user/roadmap?moduleId=${selectedModuleId}&vocabDone=true&focus=practice`);
  };

  const handleOpenAllCards = async () => {
    setSelectedCollectionId(null);
    if (!auth.accessToken) return;
    const mine = await getMyFlashcards(auth.accessToken);
    setMyCards(mine.data ?? []);
    setCardIndex(0);
  };

  return (
    <UserScreen>
      <AppHeader
        title="Flashcards"
        leftIcon={selectedModuleId ? "chevron-back-outline" : undefined}
        onLeftPress={selectedModuleId ? () => router.back() : undefined}
        rightSlot={<AvatarBadge label={avatarLabel} />}
      />

      <SurfaceCard style={styles.heroShell}>
        <View style={styles.heroAccentA} />
        <View style={styles.heroAccentB} />

        <View style={styles.heroTop}>
          <View style={styles.modePills}>
            {selectedModuleId ? (
              <Pressable
                onPress={() => setMode("lesson")}
                style={[styles.modePill, mode === "lesson" ? styles.modePillActive : null]}
              >
                <Ionicons
                  color={mode === "lesson" ? "#FFFFFF" : colors.primaryDark}
                  name="book-outline"
                  size={14}
                />
                <Text style={[styles.modePillText, mode === "lesson" ? styles.modePillTextActive : null]}>
                  Bài học
                </Text>
              </Pressable>
            ) : null}

            <Pressable
              onPress={() => setMode("mine")}
              style={[styles.modePill, mode === "mine" ? styles.modePillActive : null]}
            >
              <Ionicons
                color={mode === "mine" ? "#FFFFFF" : colors.primaryDark}
                name="albums-outline"
                size={14}
              />
              <Text style={[styles.modePillText, mode === "mine" ? styles.modePillTextActive : null]}>
                Từ của tôi
              </Text>
            </Pressable>
          </View>

          {mode === "mine" ? (
            <View style={styles.actionButtons}>
              <Pressable style={styles.heroIconButton} onPress={() => setShowTopicEditor((v) => !v)}>
                <Ionicons color={colors.primaryDark} name="folder-open-outline" size={18} />
              </Pressable>
              <Pressable
                onPress={() => setShowAddForm((v) => !v)}
                style={[styles.heroIconButton, styles.heroIconButtonPrimary]}
              >
                <Ionicons color="#FFFFFF" name="add" size={20} />
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.heroSummary}>
          <View style={styles.heroSummaryMain}>
            <Text style={styles.heroEyebrow}>{mode === "lesson" ? "Ôn từ theo module" : "Kho flashcard cá nhân"}</Text>
            <Text style={styles.heroTitle}>
              {mode === "lesson" ? "Học theo nhịp ngắn, nhớ lâu hơn." : "Biến từ mới thành bộ thẻ học mỗi ngày."}
            </Text>
            <Text style={styles.heroDescription}>
              {mode === "lesson"
                ? "Lật thẻ nhanh, nghe phát âm và hoàn thành trọn bộ từ vựng của module hiện tại."
                : "Tạo chủ đề riêng, gom từ theo ngữ cảnh và duy trì tiến độ học đều đặn."}
            </Text>
          </View>

          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeValue}>{currentCards.length}</Text>
            <Text style={styles.heroBadgeLabel}>Flashcard</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{currentCards.length}</Text>
            <Text style={styles.statLabel}>{mode === "lesson" ? "Từ trong module" : "Tổng từ hiện có"}</Text>
          </View>
          <View style={styles.statCard}>
            <Text numberOfLines={1} style={styles.statValueSmall}>
              {currentCollection?.name ?? "Tất cả"}
            </Text>
            <Text style={styles.statLabel}>Chủ đề đang xem</Text>
          </View>
        </View>

        <ProgressBar
          accentColor="#E08A2E"
          label="Tiến độ ôn thẻ"
          labelColor="#FFFFFF"
          rightLabel={currentCards.length ? `${cardIndex + 1}/${currentCards.length}` : "0/0"}
          rightLabelColor="#FFFFFF"
          value={progressValue}
        />
      </SurfaceCard>

      {mode === "mine" ? (
        <SurfaceCard style={styles.collectionCard}>
          <View style={styles.collectionHeader}>
            <Text style={styles.sectionTitle}>Chủ đề của bạn</Text>
            <Text style={styles.sectionMeta}>{collections.length} bộ sưu tập</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.chipRow}>
              <Pressable
                onPress={() => void handleOpenAllCards()}
                style={[styles.collectionChip, selectedCollectionId === null ? styles.collectionChipActive : null]}
              >
                <Text
                  style={[
                    styles.collectionChipText,
                    selectedCollectionId === null ? styles.collectionChipTextActive : null,
                  ]}
                >
                  Tất cả
                </Text>
              </Pressable>

              {collections.map((collection) => (
                <Pressable
                  key={collection.id}
                  onPress={async () => {
                    setSelectedCollectionId(collection.id);
                    if (!auth.accessToken) return;
                    const detail = await getFlashcardCollectionDetail(auth.accessToken, collection.id);
                    setMyCards(detail.data?.flashcards ?? []);
                    setCardIndex(0);
                    setShowMeaning(false);
                  }}
                  style={[
                    styles.collectionChip,
                    selectedCollectionId === collection.id ? styles.collectionChipActive : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.collectionChipText,
                      selectedCollectionId === collection.id ? styles.collectionChipTextActive : null,
                    ]}
                  >
                    {collection.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
        </SurfaceCard>
      ) : null}

      {mode === "mine" && showTopicEditor ? (
        <SurfaceCard style={styles.panelCard}>
          <Text style={styles.panelTitle}>Quản lý chủ đề</Text>
          <Text style={styles.panelHint}>Tạo nhóm từ mới để ôn luyện theo từng chủ đề riêng.</Text>

          <TextInput
            onChangeText={setNewCollectionName}
            placeholder="Tên chủ đề mới"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={newCollectionName}
          />
          <TextInput
            onChangeText={setNewCollectionDescription}
            placeholder="Mô tả ngắn"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            value={newCollectionDescription}
          />

          <View style={styles.buttonRow}>
            <Pressable disabled={working} onPress={handleCreateCollection} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Tạo chủ đề</Text>
            </Pressable>
            <Pressable
              disabled={working || !selectedCollectionId}
              onPress={handleDeleteCollection}
              style={styles.ghostDangerBtn}
            >
              <Text style={styles.ghostDangerText}>Xóa</Text>
            </Pressable>
          </View>
        </SurfaceCard>
      ) : null}

      {mode === "mine" && showAddForm ? (
        <SurfaceCard style={styles.panelCard}>
          <View style={styles.inlineSwitch}>
            <Pressable
              onPress={() => setAddMode("manual")}
              style={[styles.inlineSwitchItem, addMode === "manual" ? styles.inlineSwitchItemActive : null]}
            >
              <Text
                style={[
                  styles.inlineSwitchText,
                  addMode === "manual" ? styles.inlineSwitchTextActive : null,
                ]}
              >
                Thêm tay
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setAddMode("bulk")}
              style={[styles.inlineSwitchItem, addMode === "bulk" ? styles.inlineSwitchItemActive : null]}
            >
              <Text
                style={[
                  styles.inlineSwitchText,
                  addMode === "bulk" ? styles.inlineSwitchTextActive : null,
                ]}
              >
                Thêm JSON
              </Text>
            </Pressable>
          </View>

          {addMode === "manual" ? (
            <>
              <TextInput
                onChangeText={setManualWord}
                placeholder="Từ tiếng Anh"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={manualWord}
              />
              <TextInput
                onChangeText={setManualMeaning}
                placeholder="Nghĩa tiếng Việt"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={manualMeaning}
              />
              <TextInput
                onChangeText={setManualExample}
                placeholder="Câu ví dụ"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={manualExample}
              />
              <TextInput
                onChangeText={setManualPronunciation}
                placeholder="Phiên âm"
                placeholderTextColor={colors.textMuted}
                style={styles.input}
                value={manualPronunciation}
              />
              <Pressable disabled={working} onPress={handleManualAdd} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>{working ? "Đang thêm..." : "Thêm flashcard"}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.panelHint}>Dán JSON theo mẫu để tạo nhanh cả bộ flashcard.</Text>
              <TextInput
                multiline
                onChangeText={setBulkJson}
                placeholder="Dán JSON vào đây"
                placeholderTextColor={colors.textMuted}
                style={[styles.input, styles.jsonInput]}
                textAlignVertical="top"
                value={bulkJson}
              />
              <Pressable disabled={working} onPress={handleBulkAdd} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>{working ? "Đang thêm..." : "Thêm nhanh JSON"}</Text>
              </Pressable>
            </>
          )}
        </SurfaceCard>
      ) : null}

      <View style={styles.deckHeader}>
        <View>
          <Text style={styles.deckTitle}>{mode === "lesson" ? "Bộ thẻ bài học" : "Bộ thẻ của tôi"}</Text>
          <Text style={styles.deckSubtitle}>
            {loading
              ? "Đang tải dữ liệu..."
              : currentCard
                ? "Chạm vào thẻ để lật nghĩa và câu ví dụ."
                : "Bắt đầu bằng cách tạo một bộ từ mới cho riêng bạn."}
          </Text>
        </View>
        <View style={styles.deckCounter}>
          <Text style={styles.deckCounterText}>{currentCards.length ? `${cardIndex + 1}/${currentCards.length}` : "0/0"}</Text>
        </View>
      </View>

      <Pressable disabled={currentCards.length === 0} onPress={() => setShowMeaning((v) => !v)}>
        <SurfaceCard style={styles.flashcard}>
          <View style={styles.flashcardGlowA} />
          <View style={styles.flashcardGlowB} />

          {loading ? (
            <View style={styles.emptyState}>
              <ActivityIndicator color={colors.primaryDark} />
              <Text style={styles.emptyTitle}>Đang tải flashcard</Text>
              <Text style={styles.emptyText}>Hệ thống đang chuẩn bị bộ thẻ học cho bạn.</Text>
            </View>
          ) : currentCard ? (
            <>
              <View style={styles.flashcardTop}>
                <View style={styles.flashcardBadge}>
                  <Ionicons color="#FFFFFF" name="sparkles-outline" size={14} />
                  <Text style={styles.flashcardBadgeText}>{mode === "lesson" ? "Thẻ bài học" : "Thẻ cá nhân"}</Text>
                </View>
                <Pressable onPress={() => speakText(currentCard.englishWord)} style={styles.listenButton}>
                  <Ionicons color="#FFFFFF" name="volume-high" size={18} />
                </Pressable>
              </View>

              <Text style={styles.word}>{currentCard.englishWord}</Text>
              <Text style={styles.pronunciation}>{currentCard.pronunciation || "Chưa có phiên âm"}</Text>

              <View style={styles.controlRow}>
                <Pressable
                  onPress={() => setVoiceRegion("US")}
                  style={[styles.smallChip, voiceRegion === "US" ? styles.smallChipActive : null]}
                >
                  <Text style={[styles.smallChipText, voiceRegion === "US" ? styles.smallChipTextActive : null]}>
                    US
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setVoiceRegion("UK")}
                  style={[styles.smallChip, voiceRegion === "UK" ? styles.smallChipActive : null]}
                >
                  <Text style={[styles.smallChipText, voiceRegion === "UK" ? styles.smallChipTextActive : null]}>
                    UK
                  </Text>
                </Pressable>
                <Text style={styles.readingStatus}>
                  {isGeneratingSpeech
                    ? "Đang tạo giọng George..."
                    : isSpeaking
                      ? "Đang phát âm..."
                      : speechifyConfigured
                        ? "Giọng George · Speechify"
                        : Platform.OS === "web"
                          ? "Giọng đọc trên web"
                          : "Giọng đọc di động"}
                </Text>
              </View>

              <View style={styles.tuningGrid}>
                <View style={styles.tuningGroup}>
                  <Text style={styles.tuningLabel}>Tốc độ</Text>
                  <View style={styles.tuningControls}>
                    <Pressable
                      onPress={() => setRate((v) => Math.max(0.5, +(v - 0.1).toFixed(1)))}
                      style={styles.tuningButton}
                    >
                      <Text style={styles.tuningButtonText}>-</Text>
                    </Pressable>
                    <Text style={styles.tuningValue}>{rate.toFixed(1)}</Text>
                    <Pressable
                      onPress={() => setRate((v) => Math.min(2, +(v + 0.1).toFixed(1)))}
                      style={styles.tuningButton}
                    >
                      <Text style={styles.tuningButtonText}>+</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.tuningGroup}>
                  <Text style={styles.tuningLabel}>Âm vực</Text>
                  <View style={styles.tuningControls}>
                    <Pressable
                      onPress={() => setPitch((v) => Math.max(0, +(v - 0.1).toFixed(1)))}
                      style={styles.tuningButton}
                    >
                      <Text style={styles.tuningButtonText}>-</Text>
                    </Pressable>
                    <Text style={styles.tuningValue}>{pitch.toFixed(1)}</Text>
                    <Pressable
                      onPress={() => setPitch((v) => Math.min(2, +(v + 0.1).toFixed(1)))}
                      style={styles.tuningButton}
                    >
                      <Text style={styles.tuningButtonText}>+</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              <View style={styles.meaningBox}>
                {showMeaning ? (
                  <>
                    <Text style={styles.meaningLabel}>Nghĩa</Text>
                    <Text style={styles.meaning}>{currentCard.meaningVi || "Không có nghĩa"}</Text>
                    <View style={styles.exampleHeader}>
                      <Text style={styles.meaningLabel}>Ví dụ</Text>
                      {currentCard.exampleSentence ? (
                        <Pressable
                          onPress={(event) => {
                            event.stopPropagation();
                            speakText(currentCard.exampleSentence ?? "");
                          }}
                          style={styles.exampleListenButton}
                        >
                          <Ionicons color={colors.primaryDark} name="volume-medium" size={15} />
                          <Text style={styles.exampleListenText}>Nghe ví dụ</Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <Text style={styles.example}>{currentCard.exampleSentence || "Chưa có câu ví dụ."}</Text>
                  </>
                ) : (
                  <View style={styles.tapBox}>
                    <Ionicons color={colors.primary} name="hand-left-outline" size={18} />
                    <Text style={styles.tapHint}>Chạm để lật thẻ và xem nghĩa</Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Ionicons color="#FFFFFF" name="albums-outline" size={30} />
              </View>
              <Text style={styles.emptyTitle}>Chưa có flashcard</Text>
              <Text style={styles.emptyText}>
                {mode === "lesson"
                  ? "Module này chưa có bộ từ vựng để ôn luyện."
                  : "Tạo chủ đề hoặc thêm nhanh từ mới để bắt đầu bộ flashcard của bạn."}
              </Text>
            </View>
          )}
        </SurfaceCard>
      </Pressable>

      <View style={styles.buttonRow}>
        <Pressable
          disabled={currentCards.length === 0}
          onPress={() => {
            setShowMeaning(false);
            setCardIndex((v) => (v - 1 + currentCards.length) % currentCards.length);
          }}
          style={styles.ghostBtn}
        >
          <Text style={styles.ghostBtnText}>Trước</Text>
        </Pressable>

        <Pressable
          disabled={currentCards.length === 0}
          onPress={() => {
            setShowMeaning(false);
            if (mode === "lesson" && cardIndex === currentCards.length - 1 && selectedModuleId) {
              handleFinishLessonCards();
            } else {
              setCardIndex((v) => (v + 1) % currentCards.length);
            }
          }}
          style={styles.primaryBtn}
        >
          <Text style={styles.primaryBtnText}>
            {mode === "lesson" && cardIndex === currentCards.length - 1 && currentCards.length > 0
              ? "Hoàn thành và quay lại"
              : "Thẻ tiếp theo"}
          </Text>
        </Pressable>

        {mode === "mine" ? (
          <Pressable
            disabled={working || !currentCard}
            onPress={handleDeleteCurrentCard}
            style={styles.ghostDangerBtn}
          >
            <Text style={styles.ghostDangerText}>Xóa</Text>
          </Pressable>
        ) : null}
      </View>
    </UserScreen>
  );
}

const styles = StyleSheet.create({
  actionButtons: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  buttonRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  collectionCard: {
    backgroundColor: "#FFF9F1",
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
  },
  collectionChip: {
    backgroundColor: "#F3EFE5",
    borderColor: "#E0D6C5",
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  collectionChipActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryDark,
  },
  collectionChipText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
  },
  collectionChipTextActive: {
    color: "#FFFFFF",
  },
  collectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingRight: spacing.sm,
  },
  controlRow: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  deckCounter: {
    alignItems: "center",
    backgroundColor: "#F1E5D2",
    borderRadius: radius.pill,
    justifyContent: "center",
    minWidth: 66,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  deckCounterText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "900",
  },
  deckHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  deckSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },
  deckTitle: {
    color: colors.primaryDark,
    fontSize: 24,
    fontWeight: "900",
  },
  emptyIconWrap: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 26,
    height: 52,
    justifyContent: "center",
    marginBottom: spacing.md,
    width: 52,
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 22,
    marginTop: spacing.xs,
    textAlign: "center",
  },
  emptyTitle: {
    color: colors.primaryDark,
    fontSize: 28,
    fontWeight: "900",
    textAlign: "center",
  },
  example: {
    color: "#355882",
    fontSize: 15,
    lineHeight: 23,
    marginTop: 6,
  },
  flashcard: {
    backgroundColor: "#FFFFFF",
    marginTop: spacing.sm,
    minHeight: 500,
    overflow: "hidden",
    padding: spacing.lg,
  },
  flashcardBadge: {
    alignItems: "center",
    alignSelf: "flex-start",
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  flashcardBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  flashcardGlowA: {
    backgroundColor: "rgba(15,107,98,0.08)",
    borderRadius: 180,
    height: 220,
    position: "absolute",
    right: -80,
    top: -20,
    width: 220,
  },
  flashcardGlowB: {
    backgroundColor: "rgba(224,138,46,0.09)",
    borderRadius: 150,
    height: 180,
    left: -70,
    position: "absolute",
    top: 120,
    width: 180,
  },
  flashcardTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  ghostBtn: {
    alignItems: "center",
    backgroundColor: "#EAF0F3",
    borderRadius: radius.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  ghostBtnText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "900",
  },
  ghostDangerBtn: {
    alignItems: "center",
    backgroundColor: "#FDECE8",
    borderRadius: radius.pill,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  ghostDangerText: {
    color: "#BA3828",
    fontSize: 13,
    fontWeight: "900",
  },
  heroAccentA: {
    backgroundColor: "rgba(224,138,46,0.12)",
    borderRadius: 160,
    height: 160,
    left: -50,
    position: "absolute",
    top: 60,
    width: 160,
  },
  heroAccentB: {
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 160,
    height: 140,
    position: "absolute",
    right: -30,
    top: -20,
    width: 140,
  },
  heroBadge: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 22,
    borderWidth: 1,
    justifyContent: "center",
    minWidth: 88,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  heroBadgeLabel: {
    color: "rgba(244,248,243,0.72)",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  heroBadgeValue: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
  },
  heroDescription: {
    color: "rgba(244,248,243,0.78)",
    fontSize: 12,
    lineHeight: 18,
  },
  heroEyebrow: {
    color: "#9AE4D9",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  heroIconButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  heroIconButtonPrimary: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  heroShell: {
    backgroundColor: "#143848",
    borderColor: "#204F62",
    marginBottom: spacing.md,
    overflow: "hidden",
    padding: spacing.md,
  },
  heroSummary: {
    alignItems: "flex-start",
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  heroSummaryMain: {
    flex: 1,
    minWidth: 0,
  },
  heroTitle: {
    color: "#FFFFFF",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 29,
    marginBottom: 6,
  },
  heroTop: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  inlineSwitch: {
    backgroundColor: "#EDF3F4",
    borderRadius: radius.pill,
    flexDirection: "row",
    marginBottom: spacing.sm,
    padding: 4,
  },
  inlineSwitchItem: {
    alignItems: "center",
    borderRadius: radius.pill,
    flex: 1,
    justifyContent: "center",
    paddingVertical: 10,
  },
  inlineSwitchItemActive: {
    backgroundColor: colors.primaryDark,
  },
  inlineSwitchText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800",
  },
  inlineSwitchTextActive: {
    color: "#FFFFFF",
  },
  input: {
    backgroundColor: "#F6F4EE",
    borderColor: "#DDD5C8",
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  jsonInput: {
    minHeight: 180,
  },
  listenButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  meaning: {
    color: colors.primaryDark,
    fontSize: 24,
    fontWeight: "900",
    marginBottom: spacing.sm,
    marginTop: 6,
  },
  exampleHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  exampleListenButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.85)",
    borderColor: colors.border,
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  exampleListenText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "800",
  },
  meaningBox: {
    backgroundColor: "rgba(255,255,255,0.74)",
    borderColor: "#E4DECF",
    borderRadius: 18,
    borderWidth: 1,
    marginTop: spacing.lg,
    minHeight: 160,
    padding: spacing.md,
  },
  meaningLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "900",
  },
  modePill: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: radius.pill,
    borderWidth: 1,
    flexDirection: "row",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  modePillActive: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  modePillText: {
    color: "#F4F8F3",
    fontSize: 12,
    fontWeight: "800",
  },
  modePillTextActive: {
    color: "#FFFFFF",
  },
  modePills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  panelCard: {
    backgroundColor: "#FFF8F0",
    marginBottom: spacing.md,
  },
  panelHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  panelTitle: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: "900",
  },
  primaryBtn: {
    alignItems: "center",
    backgroundColor: colors.primaryDark,
    borderRadius: radius.pill,
    flex: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: spacing.md,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  pronunciation: {
    color: "#4A678E",
    fontSize: 18,
    marginTop: spacing.sm,
    textAlign: "center",
  },
  readingStatus: {
    color: colors.textMuted,
    fontSize: 12,
    flexShrink: 1,
  },
  sectionMeta: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  sectionTitle: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: "900",
  },
  smallChip: {
    backgroundColor: "#EAF0F4",
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  smallChipActive: {
    backgroundColor: colors.primarySoft,
  },
  smallChipText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "900",
  },
  smallChipTextActive: {
    color: colors.primaryDark,
  },
  statCard: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    flex: 1,
    minHeight: 74,
    padding: spacing.sm,
  },
  statLabel: {
    color: "rgba(244,248,243,0.7)",
    fontSize: 11,
    marginTop: 4,
  },
  statValue: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
  },
  statValueSmall: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "900",
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  tapBox: {
    alignItems: "center",
    gap: spacing.xs,
    justifyContent: "center",
    minHeight: 120,
  },
  tapHint: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
  },
  tuningButton: {
    alignItems: "center",
    backgroundColor: "#EAF0F4",
    borderRadius: radius.pill,
    height: 30,
    justifyContent: "center",
    width: 30,
  },
  tuningButtonText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "900",
  },
  tuningControls: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  tuningGrid: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  tuningGroup: {
    backgroundColor: "rgba(246,244,238,0.78)",
    borderColor: "#E3DACA",
    borderRadius: 16,
    borderWidth: 1,
    flex: 1,
    padding: spacing.sm,
  },
  tuningLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "800",
  },
  tuningValue: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "900",
    minWidth: 28,
    textAlign: "center",
  },
  word: {
    color: colors.primaryDark,
    fontSize: 40,
    fontWeight: "900",
    lineHeight: 48,
    marginTop: spacing.xl,
    textAlign: "center",
  },
});
