import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet, type ColorValue } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { theme } from '@/src/theme';

type TabIconProps = {
  color: ColorValue;
  focused: boolean;
  size: number;
};

function HomeIcon({ color, focused, size }: TabIconProps) {
  return <Ionicons color={color} name={focused ? 'home' : 'home-outline'} size={size} />;
}

function AnalyzeIcon({ color, focused, size }: TabIconProps) {
  return <Ionicons color={color} name={focused ? 'camera' : 'camera-outline'} size={size} />;
}

function GuideIcon({ color, focused, size }: TabIconProps) {
  return <Ionicons color={color} name={focused ? 'book' : 'book-outline'} size={size} />;
}

function AboutIcon({ color, focused, size }: TabIconProps) {
  return <Ionicons color={color} name={focused ? 'information-circle' : 'information-circle-outline'} size={size} />;
}

export default function TabLayout() {
  const reducedMotion = useReducedMotion();
  return (
    <Tabs
      screenOptions={{
        animation: reducedMotion ? 'none' : 'fade',
        freezeOnBlur: true,
        headerShown: false,
        sceneStyle: { backgroundColor: theme.colors.background },
        tabBarActiveTintColor: theme.colors.forest,
        tabBarInactiveTintColor: theme.colors.navInactive,
        tabBarHideOnKeyboard: true,
        tabBarIconStyle: {
          marginTop: 2,
        },
        tabBarItemStyle: {
          paddingTop: 5,
        },
        tabBarLabelStyle: {
          fontSize: 10.5,
          fontWeight: theme.type.weight.bold,
          marginTop: 1,
        },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopLeftRadius: theme.radius.navigation,
          borderTopRightRadius: theme.radius.navigation,
          ...theme.shadow.navigation,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarAccessibilityLabel: 'Home tab',
          tabBarIcon: HomeIcon,
          title: 'Home',
        }}
      />
      <Tabs.Screen
        name="analyze"
        options={{
          tabBarAccessibilityLabel: 'Analyze tab',
          tabBarIcon: AnalyzeIcon,
          title: 'Analyze',
        }}
      />
      <Tabs.Screen
        name="pest-guide"
        options={{
          tabBarAccessibilityLabel: 'Pest Guide tab',
          tabBarIcon: GuideIcon,
          title: 'Pest Guide',
        }}
      />
      <Tabs.Screen
        name="about"
        options={{
          tabBarAccessibilityLabel: 'About tab',
          tabBarIcon: AboutIcon,
          title: 'About',
        }}
      />
    </Tabs>
  );
}
