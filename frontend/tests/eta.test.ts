import { describe, it, expect } from 'vitest'
import { haversineMeters, estimateEtaSeconds, formatEta, AVG_RIDER_SPEED_KMH } from '../app/lib/eta'

describe('haversineMeters', () => {
  it('renvoie 0 pour deux points identiques', () => {
    expect(haversineMeters({ lat: 48.8566, lng: 2.3522 }, { lat: 48.8566, lng: 2.3522 })).toBe(0)
  })

  it('mesure ~5 km entre deux points parisiens (Gare de Lyon → Tour Eiffel)', () => {
    const d = haversineMeters({ lat: 48.8447, lng: 2.3799 }, { lat: 48.8584, lng: 2.2945 })
    // distance réelle ~6.4 km à vol d'oiseau — tolérance large
    expect(d).toBeGreaterThan(5_500)
    expect(d).toBeLessThan(7_500)
  })

  it('est symétrique', () => {
    const a = { lat: 48.85, lng: 2.35 }
    const b = { lat: 48.86, lng: 2.30 }
    expect(haversineMeters(a, b)).toBeCloseTo(haversineMeters(b, a), 6)
  })
})

describe('estimateEtaSeconds', () => {
  it('renvoie 0 à destination', () => {
    expect(estimateEtaSeconds({ lat: 48.85, lng: 2.35 }, { lat: 48.85, lng: 2.35 })).toBe(0)
  })

  it('croît avec la distance', () => {
    const from = { lat: 48.85, lng: 2.35 }
    const near = estimateEtaSeconds(from, { lat: 48.855, lng: 2.35 })
    const far = estimateEtaSeconds(from, { lat: 48.90, lng: 2.35 })
    expect(far).toBeGreaterThan(near)
  })

  it('applique la vitesse moyenne (distance / vitesse)', () => {
    // 5 km à 18 km/h ≈ 1000 s
    const from = { lat: 48.8447, lng: 2.3799 }
    const to = { lat: 48.8584, lng: 2.2945 }
    const meters = haversineMeters(from, to)
    const expected = Math.round(meters / ((AVG_RIDER_SPEED_KMH * 1000) / 3600))
    expect(estimateEtaSeconds(from, to)).toBe(expected)
  })

  it('renvoie 0 si la vitesse est nulle (garde anti division par zéro)', () => {
    expect(estimateEtaSeconds({ lat: 48.85, lng: 2.35 }, { lat: 48.90, lng: 2.40 }, 0)).toBe(0)
  })
})

describe('formatEta', () => {
  it('formate les minutes', () => {
    expect(formatEta(300)).toBe('5 min')
  })

  it('gère l\'arrivée imminente', () => {
    expect(formatEta(0)).toBe('Arrivée imminente')
    expect(formatEta(-10)).toBe('Arrivée imminente')
  })

  it('gère moins d\'une minute', () => {
    expect(formatEta(20)).toBe("moins d'1 min")
  })

  it('formate les heures', () => {
    expect(formatEta(3600)).toBe('1 h')
    expect(formatEta(5400)).toBe('1 h 30')
  })
})
