import { StyleSheet, Text, View } from "react-native";

import { colors, radius, spacing } from "@/src/assets/styles/user-theme";

type ProgressBarProps = {
  label?: string;
  value: number;
  rightLabel?: string;
  accentColor?: string;
  labelColor?: string;
  rightLabelColor?: string;
};

export default function ProgressBar({
  label,
  value,
  rightLabel,
  accentColor = colors.primary,
  labelColor = colors.text,
  rightLabelColor = colors.primaryDark,
}: ProgressBarProps) {
  return (
    <View>
      {label || rightLabel ? (
        <View style={styles.labelRow}>
          <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
          {rightLabel ? <Text style={[styles.rightLabel, { color: rightLabelColor }]}>{rightLabel}</Text> : null}
        </View>
      ) : null}
      <View style={styles.track}>
        <View
          style={[
            styles.fill,
            { backgroundColor: accentColor, width: `${Math.max(0, Math.min(100, value))}%` },
          ]}
        />
        <View style={styles.sheen} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    borderRadius: radius.pill,
    height: "100%",
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
  },
  labelRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  rightLabel: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "800",
  },
  sheen: {
    backgroundColor: "rgba(255,255,255,0.42)",
    borderRadius: radius.pill,
    height: "100%",
    position: "absolute",
    right: 0,
    top: 0,
    width: "28%",
  },
  track: {
    backgroundColor: "rgba(120,160,200,0.28)",
    borderRadius: radius.pill,
    height: 12,
    overflow: "hidden",
  },
});
