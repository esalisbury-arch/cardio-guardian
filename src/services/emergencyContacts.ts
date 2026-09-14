import { STORAGE_KEYS } from '../config/constants';
import { EmergencyContact } from '../types';
import { getJson, setJson } from './storage';

export async function listContacts(): Promise<EmergencyContact[]> {
  return getJson<EmergencyContact[]>(STORAGE_KEYS.emergencyContacts, []);
}

export async function saveContacts(contacts: EmergencyContact[]): Promise<void> {
  await setJson(STORAGE_KEYS.emergencyContacts, contacts);
}

export async function addContact(name: string, phone: string): Promise<EmergencyContact[]> {
  const contacts = await listContacts();
  const next: EmergencyContact[] = [
    ...contacts,
    { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: name.trim(), phone: phone.trim() },
  ];
  await saveContacts(next);
  return next;
}

export async function removeContact(id: string): Promise<EmergencyContact[]> {
  const contacts = await listContacts();
  const next = contacts.filter((c) => c.id !== id);
  await saveContacts(next);
  return next;
}
