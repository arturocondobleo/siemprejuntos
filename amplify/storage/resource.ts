import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'siemprejuntosDrive',
  access: (allow) => ({
    'evidence/*': [
      allow.authenticated.to(['read', 'write']),
      allow.guest.to(['read', 'write']) // Allow guests for the mobile upload flow if not logged in
    ]
  })
});
