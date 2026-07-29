// Projection EXPLICITE de la commande telle qu'un livreur a le droit de la voir. Deux raisons de ne
// jamais revenir a un `include` nu ici :
//  • Order.pickupCode est le code que l'entrepot remet au comptoir — le renvoyer au livreur viderait
//    de son sens le passage de relais (routes/orders.ts, transition at_warehouse -> picked_up) ;
//  • toute colonne ajoutee plus tard au modele Order serait exposee automatiquement.
// `items` porte le contenu du colis (snapshot pris a la commande) pour le tableau de bord livreur.
//
// Cette projection vit dans lib/ et non dans routes/rider.ts parce que DEUX routeurs la servent :
// le tableau de bord livreur (rider.ts) et la reponse de PATCH /api/orders/:id/status (orders.ts).
// Les deux doivent renvoyer exactement la meme forme, sinon l'ecran « livraison en cours » perd des
// champs des que le livreur avance d'une etape.
export const RIDER_ORDER_SELECT = {
  id: true,
  reference: true,
  status: true,
  customerId: true,
  riderId: true,
  pickupAddress: true,
  pickupLat: true,
  pickupLng: true,
  dropoffAddress: true,
  dropoffLat: true,
  dropoffLng: true,
  riderFee: true,
  assignmentExpiresAt: true,
  // `warehouseId` dit au client si la commande passe par un comptoir, donc si le ramassage exigera
  // un code de remise. Sans lui le frontend devait le DEDUIRE (« la commande porte des articles »),
  // proxy exact aujourd'hui mais faux des qu'une commande porte des articles sans entrepot.
  // Non sensible : le livreur connait deja l'adresse de ramassage ; seul pickupCode reste exclu.
  warehouseId: true,
  preparedAt: true, // le livreur voit SI l'entrepot a prepare, jamais le code associe
  deliveredAt: true,
  createdAt: true,
  updatedAt: true,
  items: { select: { id: true, name: true, quantity: true, imageUrl: true } },
} as const;

// meme projection + le fil d'evenements attendu par l'ecran « livraison en cours »
export const RIDER_ORDER_WITH_EVENTS_SELECT = {
  ...RIDER_ORDER_SELECT,
  events: {
    select: { id: true, orderId: true, status: true, note: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  },
} as const;
