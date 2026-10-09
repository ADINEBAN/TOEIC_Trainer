import { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';

import { colors, radius, spacing } from '@/src/assets/styles/theme';

type TextFieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences';
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
  error?: string | null;
  compact?: boolean;
  variant?: 'dark' | 'light';
  wrapperStyle?: ViewStyle;
};

export default function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  leftIcon,
  rightSlot,
  error,
  compact = false,
  variant = 'dark',
  wrapperStyle,
}: TextFieldProps) {
  const isLight = variant === 'light';

  return (
    <View
      style={[
        styles.wrapper,
        compact ? styles.wrapperCompact : null,
        wrapperStyle,
      ]}>
      <Text
        style={[
          styles.label,
          compact ? styles.labelCompact : null,
          isLight ? styles.labelLight : null,
        ]}>
        {label}
      </Text>
      <View
        style={[
          styles.inputShell,
          compact ? styles.inputShellCompact : null,
          isLight ? styles.inputShellLight : null,
          error ? styles.inputShellError : null,
        ]}>
        {leftIcon ? <View style={styles.leftIcon}>{leftIcon}</View> : null}
        <TextInput
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          keyboardType={keyboardType}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={isLight ? '#90A2BD' : colors.textMuted}
          secureTextEntry={secureTextEntry}
          style={[
            styles.input,
            compact ? styles.inputCompact : null,
            isLight ? styles.inputLight : null,
          ]}
          value={value}
        />
        {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
      </View>
      {error ? (
        <Text style={[styles.error, compact ? styles.errorCompact : null]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

export function FieldIconButton({
  children,
  onPress,
}: {
  children: ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable hitSlop={12} onPress={onPress} style={styles.iconButton}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  error: {
    color: colors.danger,
    fontSize: 13,
    marginTop: spacing.xs,
  },
  errorCompact: {
    fontSize: 11,
    marginTop: 4,
  },
  iconButton: {
    alignItems: 'center',
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  input: {
    color: colors.text,
    flex: 1,
    fontSize: 18,
    paddingVertical: 0,
  },
  inputCompact: {
    fontSize: 15,
  },
  inputLight: {
    color: '#0F1D34',
  },
  inputShell: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderColor: 'rgba(120,160,200,0.42)',
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: spacing.sm,
    minHeight: 60,
    paddingHorizontal: spacing.md,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
  },
  inputShellLight: {
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderColor: 'rgba(120,160,200,0.38)',
    shadowOpacity: 0.05,
  },
  inputShellCompact: {
    minHeight: 50,
    paddingHorizontal: 12,
  },
  inputShellError: {
    borderColor: colors.danger,
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  labelLight: {
    color: '#5D7387',
  },
  labelCompact: {
    fontSize: 13,
    marginBottom: 4,
  },
  leftIcon: {
    width: 22,
  },
  rightSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  wrapper: {
    marginBottom: spacing.md,
  },
  wrapperCompact: {
    marginBottom: 10,
  },
});
