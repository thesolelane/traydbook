import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import {
  TabHeading,
  Section,
  SectionHeading,
  SavedBanner,
  ErrorBanner,
  btnPrimary,
} from './shared'

const PROJECT_TYPES = [
  'New Construction',
  'Renovation / Remodel',
  'Repair / Maintenance',
  'Commercial Build-Out',
  'Historic Restoration',
  'Landscaping / Exterior',
  'Other',
]

const HOMEOWNER_PROJECT_TYPES = [
  'Home Renovation / Remodel',
  'Repair / Maintenance',
  'New Addition or Build',
  'Historic Restoration',
  'Landscaping / Exterior',
  'Other',
]

const BUDGET_RANGES = [
  'Under $5,000',
  '$5,000 – $25,000',
  '$25,000 – $100,000',
  '$100,000 – $500,000',
  '$500,000+',
  'Prefer not to say',
]

const TIMELINE_OPTIONS = [
  'ASAP',
  '1–3 months',
  '3–6 months',
  '6–12 months',
  'Flexible / not sure yet',
]

const TRADE_CATEGORIES = [
  'General Contractor',
  'Electrician',
  'Plumber',
  'HVAC',
  'Carpenter',
  'Mason',
  'Roofer',
  'Painter',
  'Flooring',
  'Landscaper',
  'Ironworker',
  'Concrete',
  'Other',
]

interface OwnerPreferences {
  project_type?: string | null
  budget_range?: string | null
  timeline?: string | null
  trades_needed?: string[] | null
}

const chipBase: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 20,
  fontSize: 13,
  fontFamily: 'var(--font-condensed)',
  fontWeight: 600,
  cursor: 'pointer',
  border: '1px solid var(--color-border)',
  background: 'transparent',
  color: 'var(--color-text-muted)',
  transition: 'background 0.12s, color 0.12s, border-color 0.12s',
  letterSpacing: '0.2px',
}

const chipActive: React.CSSProperties = {
  ...chipBase,
  background: 'var(--color-brand-light)',
  border: '1px solid var(--color-brand)',
  color: 'var(--color-brand)',
}

export default function PreferencesTab() {
  const { profile, refreshProfile } = useAuth()
  const isHomeowner = profile?.account_type === 'homeowner'
  const projectTypeOptions = isHomeowner ? HOMEOWNER_PROJECT_TYPES : PROJECT_TYPES

  const [projectType, setProjectType] = useState('')
  const [budgetRange, setBudgetRange] = useState('')
  const [timeline, setTimeline] = useState('')
  const [tradesNeeded, setTradesNeeded] = useState<string[]>([])

  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [errMsg, setErrMsg] = useState('')

  // Pre-fill from existing owner_preferences
  useEffect(() => {
    if (!profile) return
    const prefs = profile.owner_preferences as OwnerPreferences | null
    if (!prefs) return
    setProjectType(prefs.project_type ?? '')
    setBudgetRange(prefs.budget_range ?? '')
    setTimeline(prefs.timeline ?? '')
    setTradesNeeded(prefs.trades_needed ?? [])
  }, [profile])

  function toggleTrade(trade: string) {
    setTradesNeeded(prev =>
      prev.includes(trade) ? prev.filter(t => t !== trade) : [...prev, trade]
    )
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSavedMsg('')
    setErrMsg('')

    const prefs: OwnerPreferences = {
      project_type: projectType || null,
      budget_range: budgetRange || null,
      timeline: timeline || null,
      trades_needed: tradesNeeded.length > 0 ? tradesNeeded : null,
    }

    const { error } = await supabase
      .from('users')
      .update({ owner_preferences: prefs })
      .eq('id', profile!.id)

    setSaving(false)
    if (error) {
      setErrMsg(error.message)
    } else {
      await refreshProfile()
      setSavedMsg('Preferences saved.')
      setTimeout(() => setSavedMsg(''), 3000)
    }
  }

  return (
    <div>
      <TabHeading>Project Preferences</TabHeading>
      <p
        style={{
          fontSize: 13,
          color: 'var(--color-text-muted)',
          marginTop: -12,
          marginBottom: 20,
        }}
      >
        These preferences help match you with the right contractors and opportunities.
      </p>

      <form onSubmit={handleSave}>
        {/* Project Type */}
        <SectionHeading>Project type</SectionHeading>
        <Section>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {projectTypeOptions.map(pt => (
              <button
                key={pt}
                type="button"
                style={projectType === pt ? chipActive : chipBase}
                onClick={() => setProjectType(prev => (prev === pt ? '' : pt))}
              >
                {pt}
              </button>
            ))}
          </div>
        </Section>

        {/* Budget Range */}
        <SectionHeading>Budget range</SectionHeading>
        <Section>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {BUDGET_RANGES.map(br => (
              <button
                key={br}
                type="button"
                style={budgetRange === br ? chipActive : chipBase}
                onClick={() => setBudgetRange(prev => (prev === br ? '' : br))}
              >
                {br}
              </button>
            ))}
          </div>
        </Section>

        {/* Timeline */}
        <SectionHeading>Timeline</SectionHeading>
        <Section>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TIMELINE_OPTIONS.map(tl => (
              <button
                key={tl}
                type="button"
                style={timeline === tl ? chipActive : chipBase}
                onClick={() => setTimeline(prev => (prev === tl ? '' : tl))}
              >
                {tl}
              </button>
            ))}
          </div>
        </Section>

        {/* Trades Needed */}
        <SectionHeading>Trades needed</SectionHeading>
        <Section>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {TRADE_CATEGORIES.map(trade => (
              <button
                key={trade}
                type="button"
                style={tradesNeeded.includes(trade) ? chipActive : chipBase}
                onClick={() => toggleTrade(trade)}
              >
                {trade}
              </button>
            ))}
          </div>
        </Section>

        <div style={{ marginTop: 20 }}>
          <button type="submit" style={btnPrimary} disabled={saving}>
            {saving ? 'Saving…' : 'Save Preferences'}
          </button>
        </div>

        {savedMsg && <SavedBanner msg={savedMsg} />}
        {errMsg && <ErrorBanner msg={errMsg} />}
      </form>
    </div>
  )
}
