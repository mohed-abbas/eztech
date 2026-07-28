import crypto from 'node:crypto';
import type { OrderStatus } from '@prisma/client';

export function generateOrderReference(): string {
  return `EZ-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

export function generateReturnReference(): string {
  return `RET-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

// Alphabet du code de ramassage : ni O/0 ni I/1, le code est lu a voix haute (ou recopie depuis un
// bordereau) au comptoir de l'entrepot. 32 symboles = diviseur exact de 256, donc le modulo
// ci-dessous ne biaise aucune valeur.
const PICKUP_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const PICKUP_CODE_LENGTH = 6;

// code court remis par l'entrepot au livreur lors du ramassage (cf. Order.pickupCode)
export function generatePickupCode(): string {
  const bytes = crypto.randomBytes(PICKUP_CODE_LENGTH);
  let code = '';
  for (const byte of bytes) code += PICKUP_CODE_ALPHABET[byte % PICKUP_CODE_ALPHABET.length];
  return code;
}

// Comparaison tolerante a la saisie : le livreur tape le code sur un telephone, on ignore la casse
// et les espaces autour. A appliquer AUX DEUX cotes de la comparaison.
export function normalizePickupCode(code: string): string {
  return code.trim().toUpperCase();
}

// Le code de ramassage ne sort jamais vers un livreur ni vers un client : seuls l'admin et le
// responsable d'entrepot y ont acces. Toute reponse HTTP portant une commande passe par ici.
// La contrainte est `object` et non `{ pickupCode?: ... }` pour accepter AUSSI les commandes deja
// projetees par un `select` qui exclut la colonne (lib/orderProjection.ts) : TypeScript refusait un
// objet n'ayant aucune propriete commune avec un type dont tous les champs sont optionnels. Ces
// commandes-la n'ont deja plus de code, le retrait est alors un simple no-op.
export function stripPickupCode<T extends object>(order: T): Omit<T, 'pickupCode'> {
  const { pickupCode: _pickupCode, ...rest } = order as T & { pickupCode?: string | null };
  return rest;
}

// allowed forward transitions a rider can perform on an order they are assigned to
const RIDER_STATUS_FLOW: Record<string, OrderStatus[]> = {
  rider_assigned: ['at_warehouse'],
  at_warehouse: ['picked_up'],
  picked_up: ['in_transit'],
  in_transit: ['delivered'],
};

export function canRiderTransition(from: OrderStatus, to: OrderStatus): boolean {
  return RIDER_STATUS_FLOW[from]?.includes(to) ?? false;
}
