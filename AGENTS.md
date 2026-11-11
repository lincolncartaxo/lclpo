 # Architecture rules

- Open Stripe checkout and portal in a synchronously created separate tab with a fallback link and bounded waiting; embedded previews cannot reliably navigate to Stripe.