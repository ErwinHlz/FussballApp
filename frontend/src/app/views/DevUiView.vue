<script setup lang="ts">
// Living style guide (development builds only, route /dev/ui). Demo content is plain German
// sample data on purpose: this page is a tool for building the UI, not part of the product.
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useThemeStore, type ThemePreference } from '@/stores/theme'
import ActionBar from '@/ui/ActionBar.vue'
import AnswerControl, { type Answer } from '@/ui/AnswerControl.vue'
import BibChip from '@/ui/BibChip.vue'
import BottomSheet from '@/ui/BottomSheet.vue'
import ChalkCard from '@/ui/ChalkCard.vue'
import DateBlock from '@/ui/DateBlock.vue'
import OverflowMenu from '@/ui/OverflowMenu.vue'
import RondoLogo from '@/ui/RondoLogo.vue'
import SnackbarHost from '@/ui/SnackbarHost.vue'
import UiAvatar from '@/ui/UiAvatar.vue'
import UiBadge from '@/ui/UiBadge.vue'
import UiButton from '@/ui/UiButton.vue'
import UiChip from '@/ui/UiChip.vue'
import UiEmptyState from '@/ui/UiEmptyState.vue'
import UiIcon, { uiIconNames } from '@/ui/UiIcon.vue'
import UiIconButton from '@/ui/UiIconButton.vue'
import UiInput from '@/ui/UiInput.vue'
import UiListRow from '@/ui/UiListRow.vue'
import UiSection from '@/ui/UiSection.vue'
import UiSegmented from '@/ui/UiSegmented.vue'
import UiSkeleton from '@/ui/UiSkeleton.vue'
import UiStepper from '@/ui/UiStepper.vue'
import UiSwitch from '@/ui/UiSwitch.vue'
import WeekStrip, { type WeekDay } from '@/ui/WeekStrip.vue'
import { useSnackbar } from '@/ui/useSnackbar'

const { t } = useI18n()
const theme = useThemeStore()
const { preference } = storeToRefs(theme)
const themeOptions = computed(() =>
  (['auto', 'light', 'dark'] as ThemePreference[]).map((value) => ({
    value,
    label: t(`ui.theme.${value}`),
  })),
)

const snackbar = useSnackbar()
const answer = ref<Answer | null>(null)
const rowAnswer = ref<Answer | null>('maybe')
const minutes = ref(15)
const notify = ref(true)
const chips = ref({ injured: false, sick: true, work: false })
const segment = ref<'plan' | 'groups' | 'who' | 'info'>('plan')
const name = ref('')
const password = ref('')
const sheetOpen = ref(false)
const lastAction = ref('–')

function monday(): Date {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const week = computed<WeekDay[]>(() =>
  Array.from({ length: 7 }, (_, i) => {
    const d = monday()
    d.setDate(d.getDate() + i)
    const marks: WeekDay['marks'] =
      i === 1 || i === 3 ? ['training'] : i === 6 ? ['match'] : i === 4 ? ['event', 'training'] : []
    return { date: iso(d), marks }
  }),
)
const today = iso(new Date())
const selectedDay = ref<string | null>(null)

function decline() {
  answer.value = 'no'
  snackbar.show({
    text: 'Abgesagt',
    action: { label: t('ui.undo'), run: () => void (answer.value = null) },
  })
}
function closeAndDecline() {
  sheetOpen.value = false
  decline()
}
function onAnswer(value: Answer) {
  if (value === 'no') decline()
  else answer.value = answer.value === value ? null : value
}
</script>

<template>
  <div class="dev">
    <header class="dev__head">
      <RondoLogo />
      <h1 class="dev__title">{{ t('ui.dev.title') }}</h1>
      <UiSegmented v-model="preference" :label="t('ui.theme.label')" :options="themeOptions" />
    </header>

    <UiSection title="Antwort">
      <ChalkCard>
        <div>
          <UiBadge tone="training">Training · morgen</UiBadge>
          <p class="dev__time">18:30</p>
          <p class="dev__muted">Fr 16.10. · Sportpark, Platz 2</p>
        </div>
        <div class="dev__row">
          <BibChip color="red" label="Rot" detail="Rondo 4 gegen 2" />
          <BibChip color="blue" label="Blau" detail="Abschlussspiel" />
        </div>
        <AnswerControl :status="answer" @answer="onAnswer" />
      </ChalkCard>
      <UiListRow title="vs. FC Nachbarort" subtitle="Spiel · auswärts · 15:00">
        <template #leading><DateBlock date="2026-10-18T13:00:00Z" tone="match" /></template>
        <template #trailing>
          <AnswerControl
            :status="rowAnswer"
            variant="compact"
            label="Antwort Spiel 18.10."
            @answer="rowAnswer = rowAnswer === $event ? null : $event"
          />
        </template>
      </UiListRow>
    </UiSection>

    <UiSection title="Woche">
      <WeekStrip v-model="selectedDay" :days="week" :today="today" label="Diese Woche" />
    </UiSection>

    <UiSection title="Knöpfe">
      <div class="dev__row">
        <UiButton icon="check">Primär</UiButton>
        <UiButton variant="secondary">Sekundär</UiButton>
        <UiButton variant="ghost">Ghost</UiButton>
        <UiButton variant="danger" icon="trash">Löschen</UiButton>
        <UiButton loading>Speichert</UiButton>
        <UiButton disabled>Gesperrt</UiButton>
      </div>
      <UiButton size="lg" block icon="plus">Übung hinzufügen</UiButton>
      <div class="dev__row">
        <UiIconButton icon="chevronLeft" label="Zurück" />
        <UiIconButton icon="bell" label="Benachrichtigungen" />
        <UiIconButton icon="calendarPlus" label="Zum Kalender hinzufügen" variant="ghost" />
        <UiIconButton icon="play" label="Abspielen" variant="primary" />
        <OverflowMenu
          :items="[
            { key: 'copy', label: 'Plan kopieren', icon: 'copy' },
            { key: 'template', label: 'Als Vorlage speichern', icon: 'note' },
            { key: 'delete', label: 'Termin löschen', icon: 'trash', danger: true },
          ]"
          @select="lastAction = $event"
        />
      </div>
      <p class="dev__muted">Zuletzt im Menü gewählt: {{ lastAction }}</p>
    </UiSection>

    <UiSection title="Eingaben">
      <UiInput v-model="name" label="Name" hint="So sehen dich die anderen." autocomplete="name" />
      <UiInput v-model="password" label="Passwort" type="password" autocomplete="new-password" />
      <UiInput
        model-value="pia@"
        label="E-Mail"
        type="email"
        error="Bitte eine gültige E-Mail-Adresse eingeben."
      />
      <UiSwitch v-model="notify" label="Erinnerungen" description="Kurz vor dem Anmeldeschluss" />
      <div class="dev__row">
        <UiChip v-model="chips.injured">Verletzt</UiChip>
        <UiChip v-model="chips.sick">Krank</UiChip>
        <UiChip v-model="chips.work">Arbeit</UiChip>
      </div>
      <UiSegmented
        v-model="segment"
        label="Bereiche"
        :options="[
          { value: 'plan', label: 'Plan' },
          { value: 'groups', label: 'Gruppen' },
          { value: 'who', label: 'Wer kommt' },
          { value: 'info', label: 'Infos' },
        ]"
      />
      <UiListRow title="Rondo 4 gegen 2" subtitle="Ballbesitz">
        <template #leading><UiIcon name="grip" :size="20" /></template>
        <template #trailing>
          <UiStepper v-model="minutes" label="Dauer Rondo 4 gegen 2" :min="5" :max="60" />
        </template>
      </UiListRow>
    </UiSection>

    <UiSection title="Listen und Kennzeichen" :count="3">
      <UiListRow title="Pia" subtitle="Mittelfeld" :to="{ name: 'dev-ui' }" chevron>
        <template #leading><UiAvatar name="Pia" :number="10" /></template>
        <template #trailing><UiBadge tone="yes">Dabei</UiBadge></template>
      </UiListRow>
      <UiListRow title="Finn" subtitle="Sturm" button chevron @click="sheetOpen = true">
        <template #leading><UiAvatar name="Finn" :number="11" /></template>
        <template #trailing><UiBadge tone="maybe">Vielleicht</UiBadge></template>
      </UiListRow>
      <UiListRow title="Ben" subtitle="Abwehr">
        <template #leading><UiAvatar name="Ben" /></template>
        <template #trailing><UiBadge tone="no">Verletzt</UiBadge></template>
      </UiListRow>
      <div class="dev__row">
        <UiBadge tone="training">Training</UiBadge>
        <UiBadge tone="match">Spiel</UiBadge>
        <UiBadge tone="event">Event</UiBadge>
        <UiBadge tone="accent">Neu</UiBadge>
        <UiBadge>Entwurf</UiBadge>
      </div>
      <div class="dev__row">
        <DateBlock date="2026-10-16T16:30:00Z" tone="training" />
        <DateBlock date="2026-10-18T13:00:00Z" tone="match" />
        <DateBlock date="2026-10-24T17:00:00Z" tone="event" />
      </div>
    </UiSection>

    <UiSection title="Rückmeldung">
      <div class="dev__row">
        <UiButton variant="secondary" @click="sheetOpen = true">Sheet öffnen</UiButton>
        <UiButton variant="secondary" @click="snackbar.show({ text: 'Gespeichert' })">
          Snackbar
        </UiButton>
        <UiButton
          variant="secondary"
          @click="snackbar.show({ text: 'Konnte nicht speichern', tone: 'error' })"
        >
          Fehler
        </UiButton>
      </div>
      <div aria-busy="true" class="dev__stack">
        <UiSkeleton :lines="2" />
        <UiSkeleton shape="block" />
      </div>
      <UiEmptyState icon="calendar" title="Noch kein Termin" text="Leg das erste Training an.">
        <UiButton icon="plus">Training anlegen</UiButton>
      </UiEmptyState>
    </UiSection>

    <UiSection title="Icons" :count="uiIconNames.length">
      <ul class="dev__icons" role="list">
        <li v-for="icon in uiIconNames" :key="icon">
          <UiIcon :name="icon" />
          <span>{{ icon }}</span>
        </li>
      </ul>
    </UiSection>

    <ActionBar label="Plan">
      <span class="dev__status">
        <strong>Entwurf</strong>
        <span class="dev__muted">Nur Trainer sehen den Plan</span>
      </span>
      <UiButton @click="snackbar.show({ text: 'Plan veröffentlicht' })">Veröffentlichen</UiButton>
    </ActionBar>

    <BottomSheet v-model:open="sheetOpen" title="Absagen" description="Warum kannst du nicht?">
      <div class="dev__row">
        <UiChip>Verletzt</UiChip>
        <UiChip>Krank</UiChip>
        <UiChip>Arbeit</UiChip>
        <UiChip>Urlaub</UiChip>
      </div>
      <template #footer>
        <UiButton variant="secondary" @click="sheetOpen = false">Abbrechen</UiButton>
        <UiButton variant="danger" @click="closeAndDecline">Absagen</UiButton>
      </template>
    </BottomSheet>
    <SnackbarHost />
  </div>
</template>

<style scoped lang="scss">
.dev {
  display: flex;
  flex-direction: column;
  gap: $space-6;
  max-width: 720px;
  margin: 0 auto;
  padding: $space-4;

  &__head {
    display: flex;
    flex-direction: column;
    gap: $space-3;
  }

  &__title {
    font-size: $font-2xl;
  }

  &__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: $space-2;
  }

  &__stack {
    display: flex;
    flex-direction: column;
    gap: $space-2;
  }

  &__time {
    font-family: var(--font-display);
    font-size: $font-display;
    font-weight: 800;
    line-height: 1;
  }

  &__muted {
    color: var(--color-text-muted);
    font-size: $font-sm;
  }

  &__status {
    display: flex;
    flex: 1;
    flex-direction: column;
    line-height: 1.3;
  }

  &__icons {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
    gap: $space-2;
    margin: 0;

    li {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: $space-1;
      padding: $space-2;
      border-radius: $radius-md;
      background: var(--color-surface);
      font-size: $font-xs;
      color: var(--color-text-muted);
    }
  }
}
</style>
