import { UserInputError } from '../domain/errors';
import { CONTACT_LABELS, validateContact, whatsappLink, type ContactInput, type ContactKind } from '../domain/healthRules';
import { familyRepository } from '../repositories/familyRepository';
import { healthRepository } from '../repositories/healthRepository';
import { requireHousehold } from './common';

export interface ContactRow {
  id: string;
  kind: ContactKind;
  kindLabel: string;
  name: string;
  specialty?: string;
  phone?: string;
  whatsappUrl?: string;
  address?: string;
  hours?: string;
  fee?: string;
  mapUrl?: string;
  delivery: boolean;
  notes?: string;
  favorite: boolean;
}

export async function addContact(input: ContactInput): Promise<void> {
  const h = await requireHousehold();
  const v = validateContact(input);
  if (!v.ok) throw new UserInputError(v.error);
  await healthRepository.addContact(h.id, v.value);
}
export const setFavorite = healthRepository.setFavorite;
export const archiveContact = healthRepository.archiveContact;

export async function listContacts(): Promise<ContactRow[]> {
  const h = await familyRepository.getHousehold();
  if (!h) return [];
  const rows = await healthRepository.listContacts(h.id);
  return rows
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || a.name.localeCompare(b.name, 'ar'))
    .map((c) => ({
      id: c.id,
      kind: c.kind,
      kindLabel: CONTACT_LABELS[c.kind],
      name: c.name,
      specialty: c.specialty,
      phone: c.phone,
      whatsappUrl: c.whatsapp ? whatsappLink(c.whatsapp) : undefined,
      address: c.address,
      hours: c.hours,
      fee: c.fee,
      mapUrl: c.mapUrl,
      delivery: c.delivery,
      notes: c.notes,
      favorite: c.favorite,
    }));
}
