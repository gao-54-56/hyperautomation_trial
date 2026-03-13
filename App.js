import { StatusBar } from 'expo-status-bar';
import { useMemo, useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

function InfoCard({ title, content }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardText}>{content}</Text>
    </View>
  );
}

function StatsWidget({ label, value }) {
  return (
    <View style={styles.widget}>
      <Text style={styles.widgetLabel}>{label}</Text>
      <Text style={styles.widgetValue}>{value}</Text>
    </View>
  );
}

function HomePage() {
  return (
    <View style={styles.page}>
      <Text style={styles.pageTitle}>Home Page</Text>
      <Text style={styles.pageText}>这是通过热更新注入的页面。</Text>
    </View>
  );
}

function UserPage() {
  return (
    <View style={styles.page}>
      <Text style={styles.pageTitle}>User Page</Text>
      <Text style={styles.pageText}>用户页面已加载到空白栏。</Text>
    </View>
  );
}

const componentRegistry = {
  InfoCard,
  StatsWidget,
};

const pageRegistry = {
  HomePage,
  UserPage,
};

export default function App() {
  const [slots, setSlots] = useState([
    { id: 'slot-1', node: null },
    { id: 'slot-2', node: null },
    { id: 'slot-3', node: null },
    { id: 'slot-4', node: null },
  ]);

  const hotUpdatePackages = useMemo(
    () => ({
      components: [
        {
          slotId: 'slot-1',
          type: 'component',
          name: 'InfoCard',
          props: { title: '公告', content: '组件已通过热更新加载' },
        },
        {
          slotId: 'slot-2',
          type: 'component',
          name: 'StatsWidget',
          props: { label: '在线任务', value: '12' },
        },
      ],
      pages: [
        { slotId: 'slot-3', type: 'page', name: 'HomePage' },
        { slotId: 'slot-4', type: 'page', name: 'UserPage' },
      ],
    }),
    []
  );

  const applyHotUpdate = (packageKey) => {
    const patchList = hotUpdatePackages[packageKey] || [];

    setSlots((prevSlots) => {
      const nextSlots = [...prevSlots];

      for (const patch of patchList) {
        const index = nextSlots.findIndex((slot) => slot.id === patch.slotId);
        if (index === -1) {
          continue;
        }

        const registry = patch.type === 'component' ? componentRegistry : pageRegistry;
        const LoadedNode = registry[patch.name];

        if (!LoadedNode) {
          continue;
        }

        nextSlots[index] = {
          ...nextSlots[index],
          node: <LoadedNode {...(patch.props || {})} />,
        };
      }

      return nextSlots;
    });
  };

  const resetSlots = () => {
    setSlots((prevSlots) => prevSlots.map((slot) => ({ ...slot, node: null })));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>多空白栏热更新加载示例</Text>

        <View style={styles.buttonRow}>
          <Pressable style={styles.button} onPress={() => applyHotUpdate('components')}>
            <Text style={styles.buttonText}>热更新加载组件</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={() => applyHotUpdate('pages')}>
            <Text style={styles.buttonText}>热更新加载页面</Text>
          </Pressable>
          <Pressable style={styles.buttonOutline} onPress={resetSlots}>
            <Text style={styles.buttonOutlineText}>清空栏位</Text>
          </Pressable>
        </View>

        {slots.map((slot, index) => (
          <View key={slot.id} style={styles.slot}>
            <Text style={styles.slotTitle}>栏位 {index + 1}</Text>
            {slot.node || <Text style={styles.placeholder}>空白栏（等待热更新注入）</Text>}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f6f8',
  },
  container: {
    padding: 16,
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  button: {
    backgroundColor: '#0a84ff',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonOutline: {
    borderColor: '#0a84ff',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonOutlineText: {
    color: '#0a84ff',
    fontWeight: '600',
  },
  slot: {
    backgroundColor: '#fff',
    borderRadius: 10,
    minHeight: 130,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  slotTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
  },
  placeholder: {
    color: '#6b7280',
  },
  card: {
    gap: 6,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  cardText: {
    fontSize: 14,
    color: '#4b5563',
  },
  widget: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  widgetLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  widgetValue: {
    fontSize: 28,
    fontWeight: '800',
    color: '#111827',
  },
  page: {
    gap: 6,
  },
  pageTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  pageText: {
    fontSize: 14,
    color: '#4b5563',
  },
});
