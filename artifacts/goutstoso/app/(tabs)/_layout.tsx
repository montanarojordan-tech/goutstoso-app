import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";

import { useColors } from "@/hooks/useColors";

const tabScreens = [
  { name: "index", title: "Home", feather: "home", sf: "house", sfSelected: "house.fill" },
  { name: "inventory", title: "Stock", feather: "archive", sf: "shippingbox", sfSelected: "shippingbox.fill" },
  { name: "batches", title: "Batches", feather: "droplet", sf: "drop", sfSelected: "drop.fill" },
  { name: "orders", title: "Orders", feather: "truck", sf: "cart", sfSelected: "cart.fill" },
  { name: "customers", title: "Clients", feather: "users", sf: "person.2", sfSelected: "person.2.fill" },
] as const;

function NativeTabLayout() {
  return (
    <NativeTabs>
      {tabScreens.map((screen) => (
        <NativeTabs.Trigger key={screen.name} name={screen.name}>
          <Icon sf={{ default: screen.sf, selected: screen.sfSelected }} />
          <Label>{screen.title}</Label>
        </NativeTabs.Trigger>
      ))}
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarLabelStyle: styles.tabLabel,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: colors.border,
          elevation: 0,
          height: isWeb ? 84 : 74,
          paddingTop: 8,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={100}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.background },
              ]}
            />
          ),
      }}
    >
      {tabScreens.map((screen) => (
        <Tabs.Screen
          key={screen.name}
          name={screen.name}
          options={{
            title: screen.title,
            tabBarIcon: ({ color }) =>
              isIOS ? (
                <SymbolView name={screen.sf} tintColor={color} size={24} />
              ) : (
                <Feather name={screen.feather} size={21} color={color} />
              ),
          }}
        />
      ))}
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}

const styles = StyleSheet.create({
  tabLabel: {
    fontWeight: "700",
    fontSize: 11,
  },
});
