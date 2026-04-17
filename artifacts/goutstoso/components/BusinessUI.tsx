import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { ActivityIndicator, ImageSourcePropType, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useColors } from "@/hooks/useColors";

export function Screen({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { backgroundColor: colors.background, paddingTop: Platform.OS === "web" ? 67 : insets.top }]}> 
      {children}
    </View>
  );
}

export function Header({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  const colors = useColors();
  return (
    <View style={styles.header}>
      <Text style={[styles.eyebrow, { color: colors.primary }]}>{eyebrow}</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>{subtitle}</Text>
    </View>
  );
}

export function HeroCard({ image, children }: { image: ImageSourcePropType; children: React.ReactNode }) {
  const colors = useColors();
  return (
    <View style={[styles.hero, { borderColor: colors.border, borderRadius: colors.radius + 10 }]}> 
      <Image source={image} style={StyleSheet.absoluteFill} contentFit="cover" />
      <LinearGradient colors={["rgba(31,21,15,0.16)", "rgba(31,21,15,0.86)"]} style={StyleSheet.absoluteFill} />
      <View style={styles.heroContent}>{children}</View>
    </View>
  );
}

export function MetricCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: keyof typeof Feather.glyphMap }) {
  const colors = useColors();
  return (
    <View style={[styles.metric, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}> 
      <View style={[styles.metricIcon, { backgroundColor: colors.muted }]}> 
        <Feather name={icon} size={18} color={colors.primary} />
      </View>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
      <Text style={[styles.metricDetail, { color: colors.mutedForeground }]}>{detail}</Text>
    </View>
  );
}

export function Panel({ children }: { children: React.ReactNode }) {
  const colors = useColors();
  return <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius }]}>{children}</View>;
}

export function Pill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "success" | "warning" | "danger" }) {
  const colors = useColors();
  const background = tone === "success" ? colors.success : tone === "warning" ? colors.warning : tone === "danger" ? colors.destructive : colors.muted;
  const foreground = tone === "neutral" ? colors.mutedForeground : colors.primaryForeground;
  return <Text style={[styles.pill, { backgroundColor: background, color: foreground }]}>{label}</Text>;
}

export function PrimaryButton({ label, icon, onPress, disabled = false }: { label: string; icon?: keyof typeof Feather.glyphMap; onPress: () => void; disabled?: boolean }) {
  const colors = useColors();
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, { backgroundColor: disabled ? colors.muted : colors.primary, opacity: pressed ? 0.78 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}> 
      {icon ? <Feather name={icon} size={17} color={colors.primaryForeground} /> : null}
      <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, onPress, label }: { icon: keyof typeof Feather.glyphMap; onPress: () => void; label: string }) {
  const colors = useColors();
  return (
    <Pressable accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.muted, opacity: pressed ? 0.7 : 1 }]}> 
      <Feather name={icon} size={18} color={colors.foreground} />
    </Pressable>
  );
}

export function Field({ value, onChangeText, placeholder, keyboardType = "default" }: { value: string; onChangeText: (value: string) => void; placeholder: string; keyboardType?: "default" | "numeric" }) {
  const colors = useColors();
  return <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.mutedForeground} keyboardType={keyboardType} style={[styles.field, { borderColor: colors.input, color: colors.foreground, backgroundColor: colors.background, borderRadius: colors.radius - 4 }]} />;
}

export function EmptyState({ title, text, loading = false }: { title: string; text: string; loading?: boolean }) {
  const colors = useColors();
  return (
    <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.card, borderRadius: colors.radius }]}> 
      {loading ? <ActivityIndicator color={colors.primary} /> : <Feather name="archive" size={22} color={colors.primary} />}
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{text}</Text>
    </View>
  );
}

export const bottomSpace = Platform.OS === "web" ? 132 : 98;

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14 },
  eyebrow: { fontWeight: "700", fontSize: 12, letterSpacing: 1.4, textTransform: "uppercase" },
  title: { fontWeight: "700", fontSize: 34, letterSpacing: -1.1, marginTop: 6 },
  subtitle: { fontWeight: "400", fontSize: 15, lineHeight: 22, marginTop: 8 },
  hero: { height: 210, marginHorizontal: 20, overflow: "hidden", borderWidth: 1, marginBottom: 14 },
  heroContent: { flex: 1, justifyContent: "flex-end", padding: 18 },
  metric: { flex: 1, minWidth: "47%", padding: 14, borderWidth: 1, gap: 6 },
  metricIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  metricLabel: { fontWeight: "600", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.7 },
  metricValue: { fontWeight: "700", fontSize: 24, letterSpacing: -0.5 },
  metricDetail: { fontWeight: "400", fontSize: 12, lineHeight: 16 },
  panel: { padding: 16, borderWidth: 1, marginHorizontal: 20, marginBottom: 12 },
  pill: { overflow: "hidden", paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, fontWeight: "700", fontSize: 11 },
  button: { minHeight: 46, borderRadius: 999, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, paddingHorizontal: 18 },
  buttonText: { fontWeight: "700", fontSize: 14 },
  iconButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  field: { minHeight: 46, borderWidth: 1, paddingHorizontal: 14, fontWeight: "500", fontSize: 15, flex: 1 },
  empty: { marginHorizontal: 20, padding: 24, borderWidth: 1, alignItems: "center", gap: 8 },
  emptyTitle: { fontWeight: "700", fontSize: 17 },
  emptyText: { fontWeight: "400", textAlign: "center", lineHeight: 20 },
});
