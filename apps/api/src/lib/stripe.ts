import Stripe from 'stripe'

// TODO: Attivare quando richiesto - Stripe è predisposto ma non collegato a nessun flusso
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia',
})
