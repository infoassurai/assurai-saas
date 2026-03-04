import { loadStripe } from '@stripe/stripe-js'

// TODO: Attivare quando richiesto - Stripe è predisposto ma non collegato a nessun flusso
export const getStripe = () => {
  return loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY!)
}
