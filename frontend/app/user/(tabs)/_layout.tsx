import { FontAwesome5, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/src/assets/styles/user-theme";

type TabIconProps = {
  focused: boolean;
  label: string;
  icon: ReactNode;
};

function TabIcon({ focused, label, icon }: TabIconProps) {
  return (
    <View style={[styles.tabItem, focused ? styles.tabItemActive : null]}>
      {focused ? <View style={styles.activeHalo} /> : null}
      <View
        style={[
          styles.iconWrap,
          focused ? styles.iconWrapActive : null,
        ]}
      >
        {icon}
      </View>
      <Text style={[styles.tabLabel, focused ? styles.tabLabelActive : null]}>
        {label}
      </Text>
    </View>
  );
}

export default function UserTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarHideOnKeyboard: true,
        tabBarIconStyle: styles.tabBarIconSlot,
        tabBarItemStyle: styles.tabBarItem,
        tabBarShowLabel: false,
        tabBarStyle: styles.tabBar,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              icon={
                <Ionicons
                  color={focused ? '#FFFFFF' : colors.textMuted}
                  name={focused ? "home" : "home-outline"}
                  size={20}
                />
              }
              label="HOME"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="practice"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              icon={
                <Ionicons
                  color={focused ? '#FFFFFF' : colors.textMuted}
                  name={focused ? "sparkles" : "sparkles-outline"}
                  size={20}
                />
              }
              label="PRACTICE"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="cards"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              icon={
                <MaterialCommunityIcons
                  color={focused ? '#FFFFFF' : colors.textMuted}
                  name={focused ? "cards" : "cards-outline"}
                  size={20}
                />
              }
              label="CARDS"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="test"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              icon={
                <Ionicons
                  color={focused ? '#FFFFFF' : colors.textMuted}
                  name={focused ? "document-text" : "document-text-outline"}
                  size={20}
                />
              }
              label="TEST"
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          tabBarIcon: ({ focused }) => (
            <TabIcon
              focused={focused}
              icon={
                <FontAwesome5
                  color={focused ? '#FFFFFF' : colors.textMuted}
                  name="user-circle"
                  size={18}
                />
              }
              label="PROFILE"
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  activeHalo: {
    backgroundColor: "rgba(89,166,255,0.16)",
    borderRadius: 34,
    height: 68,
    position: "absolute",
    top: 24,
    width: 58,
  },
  iconWrap: {
    alignItems: "center",
    backgroundColor: "rgba(29,127,224,0.07)",
    borderColor: "rgba(29,127,224,0.08)",
    borderRadius: 18,
    borderWidth: 1,
    height: 50,
    justifyContent: "center",
    width: 50,
  },
  iconWrapActive: {
    backgroundColor: colors.primary,
    borderColor: "rgba(255,255,255,0.9)",
    borderWidth: 1,
    shadowColor: colors.primaryDark,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 22,
  },
  tabBar: {
    backgroundColor: "rgba(255,255,255,0.86)",
    borderTopWidth: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    bottom: 0,
    elevation: 12,
    height: 108,
    overflow: "visible",
    paddingBottom: 16,
    paddingTop: 8,
    position: "absolute",
    shadowColor: "rgba(12,28,43,0.16)",
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.12,
    shadowRadius: 18,
  },
  tabBarIconSlot: {
    height: 84,
    marginTop: 0,
    width: 74,
  },
  tabBarItem: {
    height: 94,
    justifyContent: "center",
    padding: 0,
  },
  tabItem: {
    alignItems: "center",
    gap: 6,
    height: 84,
    justifyContent: "center",
    minWidth: 72,
    position: "relative",
    width: 72,
  },
  tabItemActive: {
    transform: [{ translateY: -10 }],
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 0.6,
  },
  tabLabelActive: {
    color: colors.primaryDark,
    transform: [{ translateY: -1 }],
  },
});
