import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { addContact, listContacts, removeContact } from '../services/emergencyContacts';
import { EmergencyContact } from '../types';
import { ScreenContainer } from '../components/ScreenContainer';
import { colors, radii, spacing } from '../theme';

export function EmergencyContactsScreen() {
  const { t } = useTranslation();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    listContacts().then(setContacts);
  }, []);

  const handleAdd = async () => {
    if (!name.trim() || !phone.trim()) return;
    const next = await addContact(name, phone);
    setContacts(next);
    setName('');
    setPhone('');
  };

  const handleRemove = async (id: string) => {
    setContacts(await removeContact(id));
  };

  return (
    <ScreenContainer scroll={false}>
      {/* No repeated heading here — the native header above already shows
          "Emergency contacts" (see RootNavigator), so a second one would
          just duplicate it and eat vertical space. */}
      <Text style={styles.hint}>{t('emergencyContacts.hint')}</Text>

      <FlatList
        data={contacts}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View>
              <Text style={styles.rowName}>{item.name}</Text>
              <Text style={styles.rowPhone}>{item.phone}</Text>
            </View>
            <TouchableOpacity onPress={() => handleRemove(item.id)}>
              <Text style={styles.remove}>{t('emergencyContacts.remove')}</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.hint}>{t('emergencyContacts.empty')}</Text>}
      />

      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder={t('emergencyContacts.namePlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder={t('emergencyContacts.phonePlaceholder')}
          placeholderTextColor={colors.textMuted}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Text style={styles.addButtonText}>{t('emergencyContacts.addContact')}</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textSecondary, fontSize: 13, lineHeight: 19 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    padding: 14,
    marginBottom: spacing.sm,
  },
  rowName: { color: colors.textPrimary, fontSize: 15, fontWeight: '600' },
  rowPhone: { color: colors.textSecondary, fontSize: 13, marginTop: 2 },
  remove: { color: colors.dangerAccent, fontWeight: '700' },
  form: { marginTop: spacing.lg + 2, gap: 10 },
  input: { backgroundColor: colors.surface, color: colors.textPrimary, fontSize: 15, padding: 14, borderRadius: radii.sm },
  addButton: { backgroundColor: colors.primary, padding: 14, borderRadius: radii.sm, alignItems: 'center' },
  addButtonText: { color: colors.textOnPrimary, fontWeight: '700' },
});
