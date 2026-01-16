// lib/tracker.ts
// Auto-generated tracker for Longtail AI Ventures

const DASHBOARD_URL = process.env.ADMIN_DASHBOARD_URL || 'https://longtailaiventures.com'
const API_KEY = process.env.ADMIN_API_KEY

export async function trackEvent(event: string, data: Record<string, any>) {
  if (!API_KEY) {
    console.warn('ADMIN_API_KEY not set, skipping tracking')
    return
  }

  try {
    await fetch(${DASHBOARD_URL}/api/track, {
      method: 'POST',
      headers: {
        'x-api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        project: 'universal-interviews',
        event,
        data,
      }),
    })
  } catch (error) {
    console.error('Failed to track event:', error)
  }
}

// Convenience functions
export const trackSignup = (email: string, plan = 'free', source?: string) =>
  trackEvent('signup', { email, plan, source })

export const trackRevenue = (email: string, amount: number, plan: string) =>
  trackEvent('revenue', { email, amount, plan, type: 'subscription' })

export const trackChurn = (email: string, reason?: string) =>
  trackEvent('churn', { email, reason })
