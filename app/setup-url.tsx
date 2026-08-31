// URL Setup Screen — First time app launch, user enters their distributor URL
import React, { useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, Pressable, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { Colors, Spacing, Radius, FontSize, FontWeight, Shadow } from '@/constants/theme';

export default function SetupUrlScreen() {
  const { setApiUrl } = useAuth();
  const [url, setUrl] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!url.trim()) {
      Alert.alert('Required', 'Please enter a URL');
      return;
    }

    // Basic URL validation
    let finalUrl = url.trim();
    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      finalUrl = 'https://' + finalUrl;
    }

    // Remove trailing slash
    finalUrl = finalUrl.replace(/\/$/, '');

    setIsSaving(true);
    try {
      // Test the URL by hitting /api/ping
      const res = await fetch(`${finalUrl}/api/ping`);
      if (!res.ok) throw new Error('Server not responding');
      const data = await res.json();
      if (!data.status) throw new Error('Invalid server response');

      await setApiUrl(finalUrl);
      // Navigate directly to login — this avoids the race condition with root router
      // where React state hasn't updated yet when router.replace('/') fires
      // Small delay ensures AsyncStorage write is committed and React state is processed
      setTimeout(() => {
        router.replace('/login');
      }, 100);
    } catch (e: any) {
      Alert.alert('Connection Failed', `Server se connect nahi ho raha:\n${e.message}\n\nURL check karein aur dobara try karein.`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <LinearGradient colors={['#4F46E5', '#6366F1', '#818CF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.root}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.logoArea}>
            <View style={styles.iconCircle}>
              <MaterialIcons name="link" size={48} color="#FFFFFF" />
            </View>
            <Text style={styles.title}>Finexa Smart Credit Routes</Text>
            <Text style={styles.subtitle}>Server URL Setup</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Enter Server URL</Text>
            <Text style={styles.cardDesc}>
              Apne distributor ka server URL enter karein. Ye sirf ek baar setup karna hai.
            </Text>

            <Text style={styles.label}>Server URL</Text>
            <View style={styles.inputRow}>
              <MaterialIcons name="cloud" size={20} color={Colors.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={url}
                onChangeText={setUrl}
                placeholder="e.g. https://your-company.vercel.app"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                returnKeyType="done"
                onSubmitEditing={handleSave}
              />
            </View>

            <Pressable
              style={({ pressed }) => [
                styles.saveBtn,
                (!url.trim() || isSaving) && styles.saveBtnDisabled,
                pressed && !isSaving && styles.saveBtnPressed,
              ]}
              onPress={handleSave}
              disabled={isSaving || !url.trim()}
            >
              <LinearGradient colors={['#4F46E5', '#6366F1']} style={styles.saveBtnGradient}>
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialIcons name="check-circle" size={20} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>Connect & Save</Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </View>

          <Text style={styles.footer}>
            App data clear karne par URL bhi remove ho jayega
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.md, justifyContent: 'center' },
  logoArea: { alignItems: 'center', marginBottom: Spacing.xl },
  iconCircle: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)',
  },
  title: { fontSize: 28, fontWeight: '900', color: '#FFFFFF', letterSpacing: 1 },
  subtitle: { fontSize: FontSize.lg, color: 'rgba(255,255,255,0.85)', fontWeight: FontWeight.bold, marginTop: -2 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)', borderRadius: 24,
    padding: Spacing.lg, ...Shadow.xl, marginBottom: Spacing.lg,
  },
  cardTitle: { fontSize: FontSize.xl, fontWeight: FontWeight.bold, color: Colors.text, marginBottom: 4 },
  cardDesc: { fontSize: FontSize.sm, color: Colors.textSecondary, marginBottom: Spacing.lg, lineHeight: 20 },
  label: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, color: Colors.textSecondary, marginBottom: Spacing.xs, textTransform: 'uppercase', letterSpacing: 0.5 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#E2E8F0',
    borderRadius: 14, paddingHorizontal: Spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    backgroundColor: '#F8FAFC', marginBottom: Spacing.md,
  },
  inputIcon: { marginRight: Spacing.sm },
  input: { flex: 1, fontSize: FontSize.base, color: Colors.text },
  saveBtn: { borderRadius: 14, marginTop: Spacing.sm, overflow: 'hidden', ...Shadow.md },
  saveBtnGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: 16 },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnPressed: { opacity: 0.85 },
  saveBtnText: { fontSize: FontSize.base, fontWeight: FontWeight.bold, color: '#FFFFFF' },
  footer: { textAlign: 'center', fontSize: FontSize.xs, color: 'rgba(255,255,255,0.5)', marginTop: Spacing.md },
});
