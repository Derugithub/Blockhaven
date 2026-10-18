import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText, Button, IconButton, Screen } from '@/components/ui';
import type { Difficulty } from '@/game/survival';
import { createWorld } from '@/lib/worlds';
import { inputFontFamily } from '@/theme/font-text';
import { Colors, Fonts } from '@/theme/theme';

function randomSeed(): string {
  return String(Math.floor(Math.random() * 2_000_000_000));
}

export default function NewWorldScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [seed, setSeed] = useState(randomSeed);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = await createWorld(name.trim() || 'My world', seed, difficulty);
      router.replace({ pathname: '/play/[id]', params: { id } });
    } catch {
      setError('The world could not be created. Please try again.');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
          <AppText variant="title">New world</AppText>
        </View>
        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <AppText variant="label" color={Colors.muted}>
            Name
          </AppText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="My world"
            placeholderTextColor={Colors.muted}
            maxLength={40}
            style={[styles.input, { fontFamily: inputFontFamily(name, Fonts.regular) }]}
            returnKeyType="next"
          />
          <AppText variant="label" color={Colors.muted} style={styles.gap}>
            Seed
          </AppText>
          <View style={styles.seedRow}>
            <TextInput
              value={seed}
              onChangeText={setSeed}
              placeholder="Any number or word"
              placeholderTextColor={Colors.muted}
              maxLength={32}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, styles.flex, { fontFamily: inputFontFamily(seed, Fonts.regular) }]}
            />
            <IconButton icon="dice-outline" label="Random seed" onPress={() => setSeed(randomSeed())} />
          </View>
          <AppText variant="meta" color={Colors.muted} style={styles.note}>
            The same seed always makes the same world.
          </AppText>
          <AppText variant="label" color={Colors.muted} style={styles.gap}>
            Difficulty
          </AppText>
          <View style={styles.choices}>
            {DIFFICULTY_CHOICES.map((choice) => {
              const selected = choice.value === difficulty;
              return (
                <Pressable
                  key={choice.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${choice.title}. ${choice.text}`}
                  onPress={() => setDifficulty(choice.value)}
                  style={({ pressed }) => [styles.choice, selected && styles.choiceSelected, pressed && styles.choicePressed]}>
                  <Ionicons name={choice.icon} size={22} color={selected ? Colors.accent : Colors.muted} />
                  <View style={styles.flex}>
                    <AppText variant="bodyMedium">{choice.title}</AppText>
                    <AppText variant="meta" color={Colors.muted}>
                      {choice.text}
                    </AppText>
                  </View>
                  <Ionicons
                    name={selected ? 'radio-button-on' : 'radio-button-off'}
                    size={20}
                    color={selected ? Colors.accent : Colors.muted}
                  />
                </Pressable>
              );
            })}
          </View>
          {error ? (
            <AppText variant="meta" color={Colors.danger} style={styles.note}>
              {error}
            </AppText>
          ) : null}
          <Button label="Create and play" icon="play" busy={busy} onPress={() => void create()} style={styles.gap} />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const DIFFICULTY_CHOICES: {
  value: Difficulty;
  title: string;
  text: string;
  icon: 'moon-outline' | 'leaf-outline';
}[] = [
  { value: 'normal', title: 'Normal', text: 'Monsters come out at night and you need to eat.', icon: 'moon-outline' },
  { value: 'peaceful', title: 'Peaceful', text: 'No monsters and no hunger. Just explore and build.', icon: 'leaf-outline' },
];

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 16, paddingBottom: 12 },
  form: { paddingVertical: 8, paddingBottom: 32 },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.panel,
    color: Colors.ink,
    paddingHorizontal: 14,
    fontSize: 16,
    marginTop: 6,
  },
  gap: { marginTop: 18 },
  seedRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  note: { marginTop: 8 },
  choices: { gap: 10, marginTop: 6 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.line,
    backgroundColor: Colors.panel,
  },
  choiceSelected: { borderColor: Colors.accent, backgroundColor: Colors.panelRaised },
  choicePressed: { opacity: 0.85 },
});
