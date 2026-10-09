import { Ionicons } from "@expo/vector-icons";
import { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/src/assets/styles/user-theme";

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  onLeftPress?: () => void;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightSlot?: ReactNode;
};

export default function AppHeader({
  title,
  subtitle,
  onLeftPress,
  leftIcon = "menu-outline",
  rightSlot,
}: AppHeaderProps) {
  return (
    <View style={styles.row}>
      <View style={styles.leftSection}>
        <Pressable onPress={onLeftPress} style={styles.iconButton}>
          <Ionicons color={colors.primaryDark} name={leftIcon} size={24} />
        </Pressable>
        <View style={styles.copyBlock}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>
      {rightSlot}
    </View>
  );
}

export function AvatarBadge({ label = "A" }: { label?: string }) {
  return (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderColor: "rgba(255,255,255,0.72)",
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 50,
    justifyContent: "center",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    width: 50,
  },
  avatarText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  copyBlock: {
    gap: 4,
  },
  iconButton: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.68)",
    borderColor: "rgba(255,255,255,0.75)",
    borderRadius: radius.pill,
    borderWidth: 1,
    height: 46,
    justifyContent: "center",
    marginLeft: -4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    width: 46,
  },
  leftSection: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm,
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xl,
  },
  subtitle: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginTop: 2,
    textTransform: "uppercase",
  },
  title: {
    color: colors.primaryDark,
    fontSize: 20,
    fontWeight: "900",
  },
});
