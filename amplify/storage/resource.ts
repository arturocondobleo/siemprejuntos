import { defineStorage } from '@aws-amplify/backend';

export const storage = defineStorage({
  name: 'siemprejuntosDrive',
  access: (allow) => ({
    'evidence/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
      allow.guest.to(['read', 'write', 'delete']), // Allow guests for the mobile upload flow if not logged in
      allow.groups(['Admins']).to(['read', 'write', 'delete'])
    ]
  })
});
