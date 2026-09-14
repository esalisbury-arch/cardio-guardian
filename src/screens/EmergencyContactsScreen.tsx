import React, { useEffect, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { addContact, listContacts, removeContact } from '../services/emergencyContacts';
import { EmergencyContact } from '../types';

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
    <View style={styles.container}>
      <Text style={styles.heading}>{t('emergencyContacts.heading')}</Text>
      <Text style={styles.hint}>{t('emergencyContacts.hint')}</Text>

      <FlatList
        data={contacts}
        keyExtractor={(c) => c.id}
        style={{ marginTop: 12 }}
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
          placeholderTextColor="#666"
          value={name}
          onChangeText={setName}
        />
        <TextInput
          style={styles.input}
          placeholder={t('emergencyContacts.phonePlaceholder')}
          placeholderTextColor="#666"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAdd}>
          <Text style={styles.addButtonText}>{t('emergencyContacts.addContact')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', padding: 24, paddingTop: 64 },
  heading: { color: '#fff', fontSize: 22, fontWeight: '800' },
  hint: { color: '#999', fontSize: 13, lineHeight: 19, marginTop: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1c1c1c',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  rowName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  rowPhone: { color: '#999', fontSize: 13, marginTop: 2 },
  remove: { color: '#ff6b6b', fontWeight: '700' },
  form: { marginTop: 20, gap: 10 },
  input: { backgroundColor: '#1c1c1c', color: '#fff', fontSize: 15, padding: 14, borderRadius: 10 },
  addButton: { backgroundColor: '#2f6fed', padding: 14, borderRadius: 10, alignItems: 'center' },
  addButtonText: { color: '#fff', fontWeight: '700' },
});
