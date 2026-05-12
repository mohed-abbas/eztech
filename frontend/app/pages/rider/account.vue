<script setup lang="ts">
definePageMeta({ layout: 'default', middleware: 'auth' })
useHead({ title: 'Mon compte livreur - EzTech' })

const auth = useAuthStore()
const rider = useRiderStore()

const form = reactive({ name: '', phone: '', vehicleType: 'scooter' as 'bicycle' | 'scooter' | 'car', licenseNumber: '', insuranceNumber: '' })
const saving = ref(false)
const saved = ref(false)
const errorMsg = ref('')

onMounted(async () => {
  auth.hydrate()
  if (auth.role !== 'rider') return navigateTo('/products')
  await Promise.all([rider.fetchProfile(), rider.fetchDocuments()])
  if (rider.profile) {
    form.name = rider.profile.name
    form.phone = rider.profile.phone
    form.vehicleType = rider.profile.vehicleType ?? 'scooter'
    form.licenseNumber = rider.profile.licenseNumber ?? ''
    form.insuranceNumber = rider.profile.insuranceNumber ?? ''
  }
})

async function save() {
  saving.value = true
  saved.value = false
  errorMsg.value = ''
  try {
    await rider.updateProfile({ ...form })
    saved.value = true
  }
  catch (e) { errorMsg.value = e instanceof Error ? e.message : 'Erreur lors de l\'enregistrement' }
  finally { saving.value = false }
}

const uploadingType = ref<'license' | 'insurance' | null>(null)
async function onFile(type: 'license' | 'insurance', e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadingType.value = type
  errorMsg.value = ''
  try { await rider.uploadDocument(type, file) }
  catch (err) { errorMsg.value = err instanceof Error ? err.message : 'Échec de l\'envoi du document' }
  finally { uploadingType.value = null; (e.target as HTMLInputElement).value = '' }
}

const DOC_LABEL = { license: 'Permis de conduire', insurance: "Attestation d'assurance" } as const
const STATUS_LABEL = { pending: 'En attente', approved: 'Validé', rejected: 'Refusé' } as const
function fmtSize(b: number) { return b < 1024 ? `${b} o` : `${(b / 1024).toFixed(0)} Ko` }
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-8 space-y-6">
    <h1 class="text-2xl font-bold text-text-primary">Mon compte livreur</h1>
    <p v-if="errorMsg" class="rounded-md bg-red-50 px-4 py-2 text-sm text-red-700">{{ errorMsg }}</p>

    <Card>
      <CardHeader><CardTitle>Informations</CardTitle><CardDescription>Email : {{ rider.profile?.email }} · Statut : {{ rider.profile ? STATUS_LABEL[rider.profile.applicationStatus] : '—' }}</CardDescription></CardHeader>
      <CardContent class="space-y-4">
        <div class="grid gap-2"><Label for="name">Nom</Label><Input id="name" v-model="form.name" /></div>
        <div class="grid gap-2"><Label for="phone">Téléphone</Label><Input id="phone" v-model="form.phone" /></div>
        <div class="grid gap-2">
          <Label for="vehicle">Véhicule</Label>
          <select id="vehicle" v-model="form.vehicleType" class="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
            <option value="bicycle">Vélo</option><option value="scooter">Scooter</option><option value="car">Voiture</option>
          </select>
        </div>
        <div class="grid gap-2"><Label for="lic">Numéro de permis</Label><Input id="lic" v-model="form.licenseNumber" /></div>
        <div class="grid gap-2"><Label for="ins">Numéro d'assurance</Label><Input id="ins" v-model="form.insuranceNumber" /></div>
      </CardContent>
      <CardFooter class="gap-3">
        <Button :disabled="saving" @click="save">Enregistrer</Button>
        <span v-if="saved" class="text-sm text-emerald-600">Modifications enregistrées.</span>
      </CardFooter>
    </Card>

    <Card>
      <CardHeader><CardTitle>Documents</CardTitle><CardDescription>Permis et attestation d'assurance (JPG, PNG, WebP ou PDF, 5 Mo max)</CardDescription></CardHeader>
      <CardContent class="space-y-4">
        <div v-for="type in (['license', 'insurance'] as const)" :key="type" class="flex items-center justify-between gap-4 rounded-md border border-border p-3">
          <div>
            <p class="text-sm font-medium">{{ DOC_LABEL[type] }}</p>
            <ul class="mt-1 space-y-0.5">
              <li v-for="d in rider.documents.filter(x => x.type === type)" :key="d.id" class="text-xs text-text-muted">
                {{ d.fileName }} ({{ fmtSize(d.sizeBytes) }}) — {{ STATUS_LABEL[d.status] }}
              </li>
              <li v-if="!rider.documents.some(x => x.type === type)" class="text-xs text-text-muted">Aucun document envoyé.</li>
            </ul>
          </div>
          <label class="shrink-0">
            <input type="file" class="hidden" accept="image/jpeg,image/png,image/webp,application/pdf" @change="(e) => onFile(type, e)">
            <span class="inline-flex h-9 cursor-pointer items-center rounded-md border border-input px-3 text-sm hover:bg-accent">
              {{ uploadingType === type ? 'Envoi…' : 'Envoyer' }}
            </span>
          </label>
        </div>
      </CardContent>
    </Card>
  </div>
</template>
